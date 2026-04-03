// ============================================================
// Context Condensation System
// Smart summarization to fit within context windows
// ============================================================

import type { ChatMessage, AppSettings, Character, ContextWindow, MemoryEntry } from './types';
import { retrieveRelevantMemories, formatMemoriesForPrompt, generateSceneSummary } from './memory';
import { buildSystemPrompt, estimateMessageTokens, estimateTokens, getModelInfo, estimateTokensEnhanced } from './ai-engine';
import { streamChatResponse } from './ai-engine';

// ---- Build the context window for sending to AI ----
export async function buildContextWindow(
  allMessages: ChatMessage[],
  character: Character,
  settings: AppSettings,
  existingSummary: string
): Promise<{
  contextWindow: ContextWindow;
  messages: Array<{ role: string; content: string }>;
}> {
  const model = settings.activeModel;
  const modelInfo = getModelContextLimits(model);

  // Get relevant long-term memories
  const recentMessages = allMessages.slice(-8);
  const relevantMemories = await retrieveRelevantMemories(
    character.id,
    recentMessages,
    settings.maxMemoriesPerQuery
  );

  const memoryStrings = formatMemoriesForPrompt(relevantMemories);

  // Build system prompt
  const systemPrompt = buildSystemPrompt(character, settings, memoryStrings, existingSummary);

  // Calculate available tokens for messages
  const systemTokens = estimateTokensEnhanced(systemPrompt) + 200; // 200 buffer for system prompt
  const availableForMessages = modelInfo.contextTokens - systemTokens - modelInfo.outputTokens - 500; // safety margin

  // Select messages to include
  let selectedMessages: ChatMessage[];
  let summary = existingSummary;
  let isCondensed = false;

  if (allMessages.length === 0) {
    selectedMessages = [];
  } else if (estimateMessageTokens(allMessages.map(m => ({ role: m.role, content: m.content }))) <= availableForMessages) {
    // All messages fit
    selectedMessages = allMessages;
  } else {
    // Need condensation
    isCondensed = true;
    const { messages, newSummary } = await condenseMessages(
      allMessages,
      availableForMessages,
      settings,
      character,
      existingSummary
    );
    selectedMessages = messages;
    summary = newSummary;
  }

  // Optimize the selected messages for token efficiency
  selectedMessages = optimizeContextWindow(selectedMessages, availableForMessages);

  const totalTokens = systemTokens + estimateMessageTokens(
    selectedMessages.map(m => ({ role: m.role, content: m.content }))
  );

  // Log token usage for debugging
  console.debug(`[context] Total tokens: ${totalTokens}/${modelInfo.contextTokens}`);

  const contextWindow: ContextWindow = {
    messages: selectedMessages,
    summary,
    relevantMemories,
    totalTokens,
    isCondensed,
  };

  // Build final message array for API
  const apiMessages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...selectedMessages
      .filter(m => m.role !== 'system' && m.role !== 'memory')
      .map(m => ({ role: m.role, content: m.content })),
  ];

  return { contextWindow, messages: apiMessages };
}

// ---- Condense messages to fit within token budget ----
async function condenseMessages(
  messages: ChatMessage[],
  maxTokens: number,
  settings: AppSettings,
  character: Character,
  existingSummary: string
): Promise<{ messages: ChatMessage[]; newSummary: string }> {
  // Keep the most recent messages verbatim
  const keepRecent = settings.keepRecentCount || 8;
  const recentMessages = messages.slice(-keepRecent);
  const olderMessages = messages.slice(0, -keepRecent);

  let summary = existingSummary;

  // Enforce maximum context length to prevent runaway growth
  const maxContextMessages = 50; // Absolute maximum number of messages to consider
  if (messages.length > maxContextMessages) {
    const excess = messages.length - maxContextMessages;
    // If we have way too many messages, be more aggressive with summarization
    if (olderMessages.length > settings.summarizeThreshold * 2) {
      summary = await summarizeConversation(olderMessages.slice(0, -settings.summarizeThreshold), character, settings, existingSummary);
    }
  }

  // If we have older messages that need summarizing
  if (olderMessages.length >= settings.summarizeThreshold) {
    // Generate new summary incorporating older messages
    summary = await summarizeConversation(olderMessages, character, settings, existingSummary);
  } else if (olderMessages.length > 0) {
    // Not enough older messages for full summarization, but include some
    // Try to fit as many older messages as possible, but enforce strict token limits
    const recentTokens = estimateMessageTokens(recentMessages.map(m => ({ role: m.role, content: m.content })));
    // Reserve 20% of tokens for the AI response, use 80% for context
    const contextBudget = Math.floor(maxTokens * 0.8);
    const budgetForOlder = Math.max(0, contextBudget - recentTokens);

    let fitOlder: ChatMessage[] = [];
    let usedTokens = 0;
    // Work backwards from most recent older messages
    for (let i = olderMessages.length - 1; i >= 0; i--) {
      const msgTokens = estimateTokens(olderMessages[i].content) + 4;
      if (usedTokens + msgTokens > budgetForOlder) break;
      fitOlder.unshift(olderMessages[i]);
      usedTokens += msgTokens;
    }

    return { messages: [...fitOlder, ...recentMessages], newSummary: summary };
  }

  return { messages: recentMessages, newSummary: summary };
}

// ---- Summarize conversation ----
async function summarizeConversation(
  messages: ChatMessage[],
  character: Character,
  settings: AppSettings,
  previousSummary: string
): Promise<string> {
  // Don't summarize if not enough messages
  if (messages.length < 6) return previousSummary;

  const conversationText = messages
    .map(m => `${m.role === 'user' ? 'User' : character.name}: ${m.content}`)
    .join('\n');

  const summarizeMessages = [
    {
      role: 'system' as const,
      content: `You are a conversation summarizer. Create a brief summary of the roleplay.

IMPORTANT:
- Keep key character details, plot points, and relationships
- Include specific names, places, events
- Note emotional dynamics
- Write in 3rd person past tense
- Maximum 200 words
- Do NOT include any reasoning or meta text in your response

${previousSummary ? `Previous summary:\n${previousSummary}` : 'Create a new summary.'}`
    },
    {
      role: 'user' as const,
      content: conversationText
    }
  ];

  let summary = '';
  try {
    await streamChatResponse(settings, summarizeMessages, undefined, {
      onToken: (token) => { summary += token; },
      onDone: () => {},
      onError: () => { summary = previousSummary; },
    });
  } catch {
    summary = previousSummary;
  }

  return summary.trim() || previousSummary;
}

// ---- Get model context limits ----
function getModelContextLimits(modelId: string): { contextTokens: number; outputTokens: number } {
  // Use the model registry from ai-engine if available
  const model = getModelInfo(modelId);
  if (model) {
    return { contextTokens: model.maxContextTokens, outputTokens: model.maxOutputTokens };
  }

  // Fallback defaults
  const limits: Record<string, { contextTokens: number; outputTokens: number }> = {
    'gpt-4o': { contextTokens: 128000, outputTokens: 16384 },
    'gpt-4o-mini': { contextTokens: 128000, outputTokens: 16384 },
    'o3-mini': { contextTokens: 200000, outputTokens: 100000 },
    'claude-sonnet-4-20250514': { contextTokens: 200000, outputTokens: 16000 },
    'gemini-2.5-pro': { contextTokens: 1000000, outputTokens: 65536 },
    'openrouter-auto': { contextTokens: 200000, outputTokens: 4096 },
  };

  return limits[modelId] || { contextTokens: 8192, outputTokens: 2048 };
}

// ---- Optimize context window for token efficiency ----
export function optimizeContextWindow(
  messages: ChatMessage[],
  maxTokens: number
): ChatMessage[] {
  if (messages.length === 0) return [];

  // Calculate token usage for each message
  const messageTokens = messages.map(msg => estimateTokens(msg.content) + 4); // +4 for role overhead
  const totalTokens = messageTokens.reduce((sum, tokens) => sum + tokens, 0);

  // If total tokens are within the limit, return all messages
  if (totalTokens <= maxTokens) return messages;

  // Otherwise, prioritize recent messages and condense older ones
  const recentMessages = messages.slice(-8); // Keep the last 8 messages verbatim
  const olderMessages = messages.slice(0, -8);

  let selectedMessages: ChatMessage[] = [...recentMessages];
  let usedTokens = messageTokens.slice(-8).reduce((sum, tokens) => sum + tokens, 0);

  // Add older messages if they fit within the token budget
  for (let i = olderMessages.length - 1; i >= 0; i--) {
    const msgTokens = messageTokens[i];
    if (usedTokens + msgTokens > maxTokens) break;
    selectedMessages.unshift(olderMessages[i]);
    usedTokens += msgTokens;
  }

  return selectedMessages;
}
