// ============================================================
// Memory System v2 - Improved
// Extracts, stores, and retrieves relevant memories
// All stored locally in IndexedDB
// ============================================================

import { memoryDB } from './db';
import type { MemoryEntry, MemoryType, ChatMessage, Character } from './types';
import { streamChatResponse, estimateTokens } from './ai-engine';
import type { AppSettings } from './types';

let idCounter = 0;
function generateId(): string {
  idCounter++;
  return `mem_${Date.now()}_${idCounter}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---- Memory Expiration (days until memory is considered stale) ----
const MEMORY_EXPIRATION_DAYS = 90;
const MEMORY_DECAY_THRESHOLD = 30; // Days after which low-importance memories start decaying

// ---- Memory Extraction ----
const MEMORY_EXTRACTION_PROMPT = `You are a memory extraction system for a roleplay AI character. Analyze the conversation and extract important information.

IMPORTANT: Output ONLY valid JSON array, nothing else. No explanations, no reasoning, no text outside the JSON.

Extract memories in this exact JSON format:
[
  {"type": "fact", "content": "The user's name is Alex", "keywords": ["alex", "name"], "importance": 8},
  {"type": "event", "content": "They discovered a hidden cave", "keywords": ["cave", "discovered"], "importance": 7}
]

Types: fact, event, emotion, preference, instruction
Importance: 1-10 (10 = never forget, 1 = minor)
Extract 2-5 of the most important memories. Focus on character-relevant info. JSON only.`;

export async function extractMemories(
  recentMessages: ChatMessage[],
  character: Character,
  settings: AppSettings,
  existingMemories: MemoryEntry[]
): Promise<MemoryEntry[]> {
  if (!settings.memoryEnabled || !settings.autoExtractMemories) return [];
  if (recentMessages.length < 2) return [];

  const conversationText = recentMessages
    .slice(-8)
    .map(m => `${m.role === 'user' ? 'User' : character.name}: ${m.content}`)
    .join('\n');

  const extractionMessages = [
    { role: 'system' as const, content: MEMORY_EXTRACTION_PROMPT },
    {
      role: 'user' as const,
      content: `Extract important memories from this roleplay:\n\n${conversationText}\n\nExisting memories to avoid duplicating:\n${existingMemories.slice(0, 10).map(m => `- ${m.content}`).join('\n') || 'None yet'}`
    },
  ];

  let extractedText = '';

  try {
    await streamChatResponse(settings, extractionMessages, undefined, {
      onToken: (token) => { extractedText += token; },
      onDone: () => {},
      onError: () => {},
    });
  } catch {
    return [];
  }

  try {
    let jsonStr = extractedText.trim();
    const match = jsonStr.match(/\[[\s\S]*?\]/);
    if (!match) return [];

    const parsed = JSON.parse(match[0]) as Array<{
      type: string;
      content: string;
      keywords: string[];
      importance: number;
    }>;

    if (!parsed || !Array.isArray(parsed)) return [];

    const newMemories: MemoryEntry[] = [];
    const minImportance = settings.memoryImportanceThreshold || 3;

    for (const m of parsed) {
      if (!m.content || !m.keywords?.length) continue;
      if (m.importance < minImportance) continue;

      // Check for duplicates/similar memories
      const isDuplicate = existingMemories.some(em => 
        isSimilarMemory(em.content, m.content) ||
        em.keywords.some(k => m.keywords.includes(k))
      );

      if (isDuplicate) continue;

      // Normalize keywords
      const normalizedKeywords = [...new Set(
        m.keywords
          .map(k => k.toLowerCase().trim())
          .filter(k => k.length > 2 && k.length < 20)
      )].slice(0, 8);

      newMemories.push({
        id: generateId(),
        characterId: character.id,
        chatId: recentMessages[0]?.chatId,
        type: normalizeMemoryType(m.type),
        content: m.content.trim(),
        keywords: normalizedKeywords,
        importance: Math.min(Math.max(m.importance, 1), 10),
        timestamp: Date.now(),
        lastReferenced: Date.now(),
        accessCount: 0,
        strength: Math.min(m.importance / 10, 1), // Normalized strength
      });
    }

    if (newMemories.length > 0) {
      await memoryDB.saveMany(newMemories);
    }

    return newMemories;
  } catch {
    return [];
  }
}

function normalizeMemoryType(type: string): MemoryType {
  const t = type.toLowerCase().trim();
  if (['fact', 'event', 'emotion', 'preference', 'instruction', 'scene', 'summary'].includes(t)) {
    return t as MemoryType;
  }
  return 'fact';
}

function isSimilarMemory(a: string, b: string): boolean {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();
  
  if (aLower === bLower) return true;
  
  const aWords = new Set(aLower.split(/\s+/).filter(w => w.length > 3));
  const bWords = new Set(bLower.split(/\s+/).filter(w => w.length > 3));
  
  let commonWords = 0;
  for (const word of aWords) {
    if (bWords.has(word)) commonWords++;
  }
  
  const similarity = commonWords / Math.max(aWords.size, bWords.size);
  return similarity > 0.6;
}

// ---- Memory Retrieval (Improved) ----
export async function retrieveRelevantMemories(
  characterId: string,
  recentMessages: ChatMessage[],
  maxMemories: number
): Promise<MemoryEntry[]> {
  const allMemories = await memoryDB.getByCharacterId(characterId);
  if (allMemories.length === 0) return [];

  // Filter out expired memories
  const now = Date.now();
  const validMemories = allMemories.filter(m => {
    const daysSince = (now - m.timestamp) / (1000 * 60 * 60 * 24);
    if (daysSince > MEMORY_EXPIRATION_DAYS) return false;
    if (daysSince > MEMORY_DECAY_THRESHOLD && m.importance < 4) return false;
    return true;
  });

  if (validMemories.length === 0) return [];

  // Get recent conversation context
  const recentText = recentMessages
    .slice(-6)
    .map(m => m.content.toLowerCase())
    .join(' ');

  const recentWords = new Set(
    recentText.split(/\s+/)
      .filter(w => w.length > 2)
      .slice(-50)
  );

  // Score each memory
  const scored = validMemories.map(memory => {
    let score = scoreMemoryRelevance(memory, recentText, recentWords);
    
    // Boost for never been referenced (new memories)
    if (memory.accessCount === 0) {
      score *= 1.2;
    }
    
    // Boost high-importance memories
    score += memory.importance * 0.3;
    
    return { memory, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const selected = scored.slice(0, maxMemories);

  // Update access counts in background
  const toUpdate = selected.map(({ memory }) => ({
    ...memory,
    lastReferenced: now,
    accessCount: memory.accessCount + 1,
  }));
  
  // Save updates (don't await to not block)
  memoryDB.saveMany(toUpdate).catch((error) => {
    console.error('Failed to update memory access counts:', error);
  });

  return selected.map(s => s.memory);
}

function scoreMemoryRelevance(
  memory: MemoryEntry,
  recentText: string,
  recentWords: Set<string>
): number {
  let score = 0;

  // Direct keyword matches (highest weight)
  for (const keyword of memory.keywords) {
    const kw = keyword.toLowerCase();
    if (recentText.includes(kw)) {
      score += 5;
      // Bonus for exact match
      if (recentWords.has(kw)) {
        score += 3;
      }
    }
  }

  // Content word matching
  const contentWords = memory.content.toLowerCase().split(/\s+/);
  for (const word of contentWords) {
    if (word.length > 4 && recentWords.has(word)) {
      score += 1;
    }
  }

  // Recency decay factor
  const daysSince = (Date.now() - memory.timestamp) / (1000 * 60 * 60 * 24);
  const recencyFactor = Math.max(0.3, 1 - (daysSince / MEMORY_EXPIRATION_DAYS));
  score *= recencyFactor;

  // Strength factor (from extraction importance)
  score += (memory.strength || 0.5) * 2;

  return score;
}

// ---- Memory Consolidation (merge similar memories) ----
export async function consolidateMemories(characterId: string): Promise<number> {
  const memories = await memoryDB.getByCharacterId(characterId);
  if (memories.length < 5) return 0;

  const toDelete: string[] = [];
  const toUpdate: MemoryEntry[] = [];

  for (let i = 0; i < memories.length; i++) {
    for (let j = i + 1; j < memories.length; j++) {
      const a = memories[i];
      const b = memories[j];

      if (toDelete.includes(a.id) || toDelete.includes(b.id)) continue;

      if (isSimilarMemory(a.content, b.content)) {
        // Merge: keep the one with higher importance
        const keep = a.importance >= b.importance ? a : b;
        const discard = a.importance >= b.importance ? b : a;

        // Update the kept memory
        const merged: MemoryEntry = {
          ...keep,
          keywords: [...new Set([...keep.keywords, ...discard.keywords])].slice(0, 10),
          importance: Math.max(keep.importance, discard.importance),
          accessCount: Math.max(keep.accessCount, discard.accessCount),
          strength: Math.min((keep.strength || 0.5) + 0.1, 1),
        };

        toUpdate.push(merged);
        toDelete.push(discard.id);
      }
    }
  }

  // Save merged memories
  if (toUpdate.length > 0) {
    await memoryDB.saveMany(toUpdate);
  }

  // Delete merged duplicates
  for (const id of toDelete) {
    await memoryDB.delete(id);
  }

  return toDelete.length;
}

// ---- Format memories for prompt ----
export function formatMemoriesForPrompt(memories: MemoryEntry[]): string[] {
  if (memories.length === 0) return [];
  
  return memories.map(m => {
    const typeLabel = m.type.charAt(0).toUpperCase() + m.type.slice(1);
    const strengthIndicator = m.strength && m.strength > 0.8 ? ' (Important)' : '';
    return `[${typeLabel}]${strengthIndicator} ${m.content}`;
  });
}

// ---- Memory Stats ----
export function getMemoryStats(memories: MemoryEntry[]): {
  total: number;
  byType: Record<MemoryType, number>;
  avgImportance: number;
  recentCount: number;
  strongCount: number;
} {
  const byType: Partial<Record<MemoryType, number>> = {};
  let totalImportance = 0;
  let recentCount = 0;
  let strongCount = 0;
  const oneDayAgo = Date.now() - (1000 * 60 * 60 * 24);

  for (const m of memories) {
    byType[m.type] = (byType[m.type] || 0) + 1;
    totalImportance += m.importance;
    if (m.timestamp > oneDayAgo) recentCount++;
    if (m.strength && m.strength > 0.7) strongCount++;
  }

  return {
    total: memories.length,
    byType: byType as Record<MemoryType, number>,
    avgImportance: memories.length > 0 ? totalImportance / memories.length : 0,
    recentCount,
    strongCount,
  };
}
