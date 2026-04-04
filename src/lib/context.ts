// ============================================================
// Context Condensation System
// Smart summarization to fit within context windows
// ============================================================

import type { ChatMessage, AppSettings, Character, ContextWindow } from './types';
import { retrieveRelevantMemories, formatMemoriesForPrompt } from './memory';
import {
  buildSystemPrompt,
  estimateMessageTokens,
  estimateTokens,
  estimateTokensEnhanced,
  getModelInfo,
  streamChatResponse,
} from './ai-engine';

// ---- Constants ----

/** Minimum number of messages required before attempting summarization. */
const MIN_MESSAGES_TO_SUMMARIZE = 6;

/** Absolute cap on the number of messages ever considered in one pass. */
const MAX_CONTEXT_MESSAGES = 30;

/** How many recent messages are always kept verbatim. */
const DEFAULT_KEEP_RECENT = 6;

/** Summary word-count ceiling sent to the summarizer. */
const SUMMARY_MAX_WORDS = 150;

/** Safety token margin reserved on top of the output-token budget. */
const CONTEXT_SAFETY_MARGIN = 500;

/** Token overhead added to the system prompt estimate. */
const SYSTEM_PROMPT_BUFFER = 200;

// ---- Build the context window for sending to AI ----

export async function buildContextWindow(
  allMessages: ChatMessage[],
  character: Character,
  settings: AppSettings,
  existingSummary: string,
  chatId?: string,
): Promise<{
  contextWindow: ContextWindow;
  messages: Array<{ role: string; content: string }>;
}> {
  const modelInfo = getModelContextLimits(settings.activeModel);

  // Retrieve long-term memories relevant to the recent conversation
  const recentMessages = allMessages.slice(-DEFAULT_KEEP_RECENT);
  const relevantMemories = await retrieveRelevantMemories(
    character.id,
    recentMessages,
    settings.maxMemoriesPerQuery ?? 10,
    chatId,
  );
  const memoryStrings = formatMemoriesForPrompt(relevantMemories);

  // Build system prompt and estimate its token cost
  const systemPrompt = buildSystemPrompt(character, settings, memoryStrings, existingSummary);
  const systemTokens = estimateTokensEnhanced(systemPrompt) + SYSTEM_PROMPT_BUFFER;

  // How many tokens are left for the actual chat messages
  const availableForMessages =
    modelInfo.contextTokens - systemTokens - modelInfo.outputTokens - CONTEXT_SAFETY_MARGIN;

  // FIX: Guard against impossible budgets (e.g. huge system prompt on a tiny model)
  if (availableForMessages <= 0) {
    console.warn(
      `[context] System prompt (${systemTokens} tokens) leaves no room for messages ` +
        `in model with ${modelInfo.contextTokens} context tokens.`,
    );
  }

  let selectedMessages: ChatMessage[] = [];
  let summary = existingSummary;
  let isCondensed = false;

  if (allMessages.length > 0) {
    const allTokens = estimateMessageTokens(
      allMessages.map(m => ({ role: m.role, content: m.content })),
    );

    if (availableForMessages > 0 && allTokens <= availableForMessages) {
      // Everything fits — no condensation needed
      selectedMessages = allMessages;
    } else {
      isCondensed = true;
      const result = await condenseMessages(
        allMessages,
        availableForMessages,
        settings,
        character,
        existingSummary,
      );
      selectedMessages = result.messages;
      summary = result.newSummary;
    }
  }

  // Final trim to ensure we never exceed the budget
  selectedMessages = optimizeContextWindow(selectedMessages, Math.max(availableForMessages, 0));

  const messageTokens = estimateMessageTokens(
    selectedMessages.map(m => ({ role: m.role, content: m.content })),
  );
  const totalTokens = systemTokens + messageTokens;

  console.debug(
    `[context] tokens: system=${systemTokens}, messages=${messageTokens}, ` +
      `total=${totalTokens}/${modelInfo.contextTokens}, condensed=${isCondensed}`,
  );

  const contextWindow: ContextWindow = {
    messages: selectedMessages,
    summary,
    relevantMemories,
    totalTokens,
    isCondensed,
  };

  // Build the final message array for the API call.
  // FIX: Filter roles 'system' and 'memory' here to avoid leaking internal message types
  // to providers that only accept 'user' / 'assistant'.
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
  existingSummary: string,
): Promise<{ messages: ChatMessage[]; newSummary: string }> {
  const keepRecent = settings.keepRecentCount ?? DEFAULT_KEEP_RECENT;

  // FIX: Guard against keepRecent being larger than the message array — slice handles
  // negative indices, but an explicit clamp makes the intent clear and avoids confusion.
  const clampedKeep = Math.min(keepRecent, messages.length);
  const recentMessages = messages.slice(-clampedKeep);

  // FIX: When keepRecent >= messages.length, olderMessages is empty. The original code
  // could enter the summarization branch with zero older messages in that case.
  const olderMessages = clampedKeep < messages.length ? messages.slice(0, -clampedKeep) : [];

  let summary = existingSummary;

  // Hard cap: if the total history is enormous, aggressively summarize the oldest chunk
  // before the normal threshold check, so we never hold unbounded state in memory.
  if (messages.length > MAX_CONTEXT_MESSAGES) {
    const summarizeThreshold = settings.summarizeThreshold ?? DEFAULT_KEEP_RECENT;
    // Summarize everything we won't be keeping as "recent older" messages
    if (olderMessages.length > summarizeThreshold * 2) {
      const toSummarize = olderMessages.slice(0, -summarizeThreshold);
      summary = await summarizeConversation(toSummarize, character, settings, summary);
    }
  }

  const summarizeThreshold = settings.summarizeThreshold ?? DEFAULT_KEEP_RECENT;

  if (olderMessages.length >= summarizeThreshold) {
    // Enough older messages — generate / extend the summary and drop them
    summary = await summarizeConversation(olderMessages, character, settings, summary);
    return { messages: recentMessages, newSummary: summary };
  }

  if (olderMessages.length > 0) {
    // Not enough older messages to warrant a full summarization pass.
    // Fit as many as possible within the remaining token budget.
    const recentTokens = estimateMessageTokens(
      recentMessages.map(m => ({ role: m.role, content: m.content })),
    );

    // FIX: Cap budget at maxTokens to prevent negative budget when recentTokens is huge.
    const budgetForOlder = Math.max(0, Math.floor(maxTokens * 0.8) - recentTokens);

    const fitOlder: ChatMessage[] = [];
    let usedTokens = 0;

    for (let i = olderMessages.length - 1; i >= 0; i--) {
      // FIX: Use the same per-message overhead (+4) that estimateMessageTokens uses,
      // so the budget accounting is consistent.
      const msgTokens = estimateTokens(olderMessages[i].content ?? '') + 4;
      if (usedTokens + msgTokens > budgetForOlder) break;
      fitOlder.unshift(olderMessages[i]);
      usedTokens += msgTokens;
    }

    return { messages: [...fitOlder, ...recentMessages], newSummary: summary };
  }

  // No older messages at all — just return the recent window
  return { messages: recentMessages, newSummary: summary };
}

// ---- Summarize a slice of conversation ----

async function summarizeConversation(
  messages: ChatMessage[],
  character: Character,
  settings: AppSettings,
  previousSummary: string,
): Promise<string> {
  // FIX: Return early without an API call when there is nothing worth summarizing.
  if (messages.length < MIN_MESSAGES_TO_SUMMARIZE) return previousSummary;

  // FIX: Filter out internal roles ('system', 'memory') before building the transcript,
  // so the summarizer model only sees user/assistant turns.
  const transcript = messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => `${m.role === 'user' ? (settings.userPersona.name || 'You') : character.name}: ${m.content ?? ''}`)
    .join('\n');

  // FIX: If filtering left us with nothing to summarize, bail early.
  if (!transcript.trim()) return previousSummary;

  const systemContent = [
    'You are a conversation summarizer. Create a brief summary of the roleplay.',
    '',
    'IMPORTANT:',
    '- Keep key character details, plot points, and relationships',
    '- Include specific names, places, events',
    '- Note emotional dynamics',
    '- Write in 3rd person past tense',
    `- Maximum ${SUMMARY_MAX_WORDS} words`,
    '- Do NOT include any reasoning or meta text in your response',
    '',
    previousSummary
      ? `Previous summary (extend/update it):\n${previousSummary}`
      : 'Create a new summary.',
  ].join('\n');

  const summarizeMessages = [
    { role: 'system' as const, content: systemContent },
    { role: 'user' as const, content: transcript },
  ];

  let summary = '';

  try {
    await streamChatResponse(settings, summarizeMessages, undefined, {
      onToken: token => { summary += token; },
      onDone: () => {},
      // FIX: On error fall back to the previous summary rather than returning an empty string,
      // which would silently wipe all accumulated context.
      onError: err => {
        console.warn('[context] Summarization failed, keeping previous summary:', err);
        summary = previousSummary;
      },
    });
  } catch {
    // Network / abort errors — keep what we have
    return previousSummary;
  }

  const trimmed = summary.trim();
  // FIX: Never replace a valid previous summary with an empty result
  return trimmed || previousSummary;
}

// ---- Get model context limits ----

function getModelContextLimits(modelId: string): { contextTokens: number; outputTokens: number } {
  // Prefer the live registry from ai-engine (single source of truth)
  const model = getModelInfo(modelId);
  if (model) {
    return { contextTokens: model.maxContextTokens, outputTokens: model.maxOutputTokens };
  }

  // Sparse fallback table for models that might not be in the registry yet.
  // FIX: Removed the duplicate fallback table — the registry in ai-engine already covers
  // all these models. The sparse table below only catches genuinely unknown IDs.
  console.warn(`[context] Unknown model "${modelId}", using conservative context defaults.`);
  return { contextTokens: 8192, outputTokens: 2048 };
}

// ---- Optimize context window for token efficiency ----

export function optimizeContextWindow(
  messages: ChatMessage[],
  maxTokens: number,
): ChatMessage[] {
  if (messages.length === 0) return [];

  // FIX: Handle degenerate maxTokens values gracefully
  if (maxTokens <= 0) return [];

  // Per-message token costs (role overhead of +4 is consistent with estimateMessageTokens)
  const messageTokens = messages.map(msg => estimateTokens(msg.content ?? '') + 4);
  const totalTokens = messageTokens.reduce((sum, t) => sum + t, 0);

  if (totalTokens <= maxTokens) return messages;

  // Always preserve the most recent N messages verbatim
  const keepRecent = Math.min(DEFAULT_KEEP_RECENT, messages.length);
  const recentMessages = messages.slice(-keepRecent);
  const olderMessages = messages.slice(0, -keepRecent);

  // Tokens already committed to the recent window
  const recentTokens = messageTokens
    .slice(-keepRecent)
    .reduce((sum, t) => sum + t, 0);

  // FIX: If even the recent window alone exceeds the budget, return it as-is rather
  // than returning an empty array — having *some* context is better than none.
  if (recentTokens >= maxTokens) return recentMessages;

  let usedTokens = recentTokens;
  const selectedOlder: ChatMessage[] = [];

  // Walk backwards through older messages, greedily fitting what we can
  for (let i = olderMessages.length - 1; i >= 0; i--) {
    const cost = messageTokens[i];
    if (usedTokens + cost > maxTokens) break;
    selectedOlder.unshift(olderMessages[i]);
    usedTokens += cost;
  }

  return [...selectedOlder, ...recentMessages];
}