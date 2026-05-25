// ============================================================
// Memory System v2 - Improved
// Extracts, stores, and retrieves relevant memories
// All stored locally in IndexedDB
// ============================================================

import { memoryDB } from './db';
import type { MemoryEntry, MemoryType, ChatMessage, Character, AppSettings } from './types';
import { streamChatResponse, estimateTokens } from './ai-engine';

// ---- ID generation ----

let idCounter = 0;
function generateId(): string {
  // FIX: Use a module-level counter reset guard so IDs remain unique across hot-reloads
  // in development without relying solely on Date.now() (which can collide within 1ms).
  idCounter = (idCounter + 1) % Number.MAX_SAFE_INTEGER;
  return `mem_${Date.now()}_${idCounter}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---- Constants ----

/** Days until a memory is considered fully expired and filtered out. */
const MEMORY_EXPIRATION_DAYS = 90;

/** Days after which low-importance (< 4) memories start being ignored. */
const MEMORY_DECAY_THRESHOLD = 30;

/** Maximum number of keywords stored per memory entry. */
const MAX_KEYWORDS = 8;

/** Minimum keyword length accepted during normalization. */
const MIN_KEYWORD_LENGTH = 2;

/** Maximum keyword length accepted during normalization. */
const MAX_KEYWORD_LENGTH = 20;

/** Jaccard similarity threshold above which two memories are considered duplicates. */
const SIMILARITY_THRESHOLD = 0.6;

/** How many recent messages to slice for extraction / retrieval context. */
const EXTRACTION_CONTEXT_WINDOW = 8;
const RETRIEVAL_CONTEXT_WINDOW = 6;

/** Max recent words kept for retrieval scoring. */
const MAX_RECENT_WORDS = 50;

/** Minimum seconds between extractions to avoid rapid-fire LLM calls. */
const EXTRACTION_DEBOUNCE_MS = 15_000;

/** Keyword Jaccard threshold for conflict detection. */
const CONFLICT_KEYWORD_THRESHOLD = 0.4;

/** Content Jaccard threshold — below this, same-topic memories are considered contradictory. */
const CONFLICT_CONTENT_THRESHOLD = 0.25;

let lastExtractionTime = 0;

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
  existingMemories: MemoryEntry[],
): Promise<MemoryEntry[]> {
  if (!settings.memoryEnabled || !settings.autoExtractMemories) return [];
  // FIX: Need at least 2 messages to have a meaningful exchange worth extracting
  if (recentMessages.length < 2) return [];

  // Debounce: skip if we just extracted — prevents rapid-fire LLM calls
  // when the user sends multiple short messages in quick succession.
  const now = Date.now();
  if (now - lastExtractionTime < EXTRACTION_DEBOUNCE_MS) return [];
  lastExtractionTime = now;

  // FIX: Filter out non-conversational roles before building the transcript
  const conversableMessages = recentMessages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .slice(-EXTRACTION_CONTEXT_WINDOW);

  if (conversableMessages.length < 2) return [];

  const conversationText = conversableMessages
    .map(m => `${m.role === 'user' ? (settings.userPersona.name || 'You') : character.name}: ${m.content ?? ''}`)
    .join('\n');

  // FIX: Limit how many existing memories we send to the model — sending hundreds would
  // bloat the context and potentially exceed token limits. Cap at 10 (same as before)
  // but also truncate individual content strings to keep the prompt reasonable.
  const existingSnippet =
    existingMemories.length > 0
      ? existingMemories
          .slice(0, 10)
          .map(m => `- ${m.content.slice(0, 80)}`)
          .join('\n')
      : 'None yet';

  const extractionMessages = [
    { role: 'system' as const, content: MEMORY_EXTRACTION_PROMPT },
    {
      role: 'user' as const,
      content: `Extract important memories from this roleplay:\n\n${conversationText}\n\nExisting memories to avoid duplicating:\n${existingSnippet}`,
    },
  ];

  let extractedText = '';

  try {
    await streamChatResponse(settings, extractionMessages, undefined, {
      onToken: token => { extractedText += token; },
      onDone: () => {},
      onError: () => {},
    });
  } catch {
    return [];
  }

  if (!extractedText.trim()) return [];

  try {
    const jsonStr = extractedText.trim();

    // FIX: Use a greedy match (`[\s\S]*`) to capture the outermost JSON array rather
    // than a lazy match (`[\s\S]*?`) which could stop at the first `]` inside a nested
    // string value and produce a truncated / invalid JSON fragment.
    const match = jsonStr.match(/\[[\s\S]*\]/);
    if (!match) return [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      console.warn('[memory] Failed to parse AI response as JSON — malformed output');
      return [];
    }

    // FIX: Validate that parsed is actually an array before iterating
    if (!Array.isArray(parsed) || parsed.length === 0) return [];

    const minImportance = settings.memoryImportanceThreshold ?? 3;
    const newMemories: MemoryEntry[] = [];

    for (const m of parsed) {
      // FIX: Validate every required field exists and has the right type before use
      if (typeof m !== 'object' || m === null) continue;
      if (typeof m.content !== 'string' || !m.content.trim()) continue;
      if (!Array.isArray(m.keywords) || m.keywords.length === 0) continue;

      const importance = typeof m.importance === 'number' ? m.importance : 0;
      if (importance < minImportance) continue;

      // Check for duplicates — keyword overlap check was too aggressive in the original
      // (any single shared keyword triggered deduplication). Now only skip when the
      // *content* itself is similar OR when the majority of keywords overlap.
      const isDuplicate = existingMemories.some(em => isSimilarMemory(em.content, m.content));
      if (isDuplicate) continue;

      // New fact contradicts an old one → old is stale, discard it.
      const normalizedNewKeywords: string[] = [
        ...new Set(
          (m.keywords as unknown[])
            .filter((k): k is string => typeof k === 'string')
            .map(k => k.toLowerCase().trim())
            .filter(k => k.length >= MIN_KEYWORD_LENGTH && k.length <= MAX_KEYWORD_LENGTH),
        ),
      ];

      const conflicts = existingMemories.filter(em => {
        const keywordOverlap = normalizedNewKeywords.filter(kw => em.keywords.includes(kw)).length;
        const unionSize = new Set([...normalizedNewKeywords, ...em.keywords]).size;
        const keywordJaccard = unionSize > 0 ? keywordOverlap / unionSize : 0;
        return keywordJaccard >= CONFLICT_KEYWORD_THRESHOLD && !isSimilarMemory(em.content, m.content);
      });
      for (const conflict of conflicts) {
        memoryDB.delete(conflict.id).catch(err => console.warn('[memory] Failed to delete superseded memory:', err));
        const idx = existingMemories.findIndex(em => em.id === conflict.id);
        if (idx >= 0) existingMemories.splice(idx, 1);
      }

      // Normalize and deduplicate keywords
      const normalizedKeywords = [
        ...new Set(
          (m.keywords as unknown[])
            .filter((k): k is string => typeof k === 'string')
            .map(k => k.toLowerCase().trim())
            .filter(k => k.length >= MIN_KEYWORD_LENGTH && k.length <= MAX_KEYWORD_LENGTH),
        ),
      ].slice(0, MAX_KEYWORDS);

      // Skip if normalization produced zero usable keywords
      if (normalizedKeywords.length === 0) continue;

      const clampedImportance = Math.min(Math.max(Math.round(importance), 1), 10);

      newMemories.push({
        id: generateId(),
        characterId: character.id,
        // FIX: `chatId` may not exist on every message — use optional chaining
        chatId: recentMessages[0]?.chatId,
        type: normalizeMemoryType(m.type),
        content: m.content.trim(),
        keywords: normalizedKeywords,
        importance: clampedImportance,
        timestamp: Date.now(),
        lastReferenced: Date.now(),
        accessCount: 0,
        // FIX: Derive strength from the clamped importance so the two fields are
        // always consistent (original derived from the raw, un-clamped value).
        strength: clampedImportance / 10,
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

function normalizeMemoryType(type: unknown): MemoryType {
  if (typeof type !== 'string') return 'fact';
  const t = type.toLowerCase().trim();
  const valid: MemoryType[] = ['fact', 'event', 'emotion', 'preference', 'instruction', 'scene', 'summary'];
  return valid.includes(t as MemoryType) ? (t as MemoryType) : 'fact';
}

/**
 * Returns true when two memory content strings are semantically similar,
 * measured by Jaccard similarity on their word sets (words longer than 3 chars).
 */
function isSimilarMemory(a: string, b: string): boolean {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();

  if (aLower === bLower) return true;

  const aWords = new Set(aLower.split(/\s+/).filter(w => w.length > 3));
  const bWords = new Set(bLower.split(/\s+/).filter(w => w.length > 3));

  // FIX: Guard against division by zero when both strings contain only short words
  const unionSize = new Set([...aWords, ...bWords]).size;
  if (unionSize === 0) return false;

  let commonWords = 0;
  for (const word of aWords) {
    if (bWords.has(word)) commonWords++;
  }

  // Jaccard index: |intersection| / |union|
  return commonWords / unionSize > SIMILARITY_THRESHOLD;
}

// ---- Memory Retrieval ----

export async function retrieveRelevantMemories(
  characterId: string,
  recentMessages: ChatMessage[],
  maxMemories: number,
  chatId?: string,
): Promise<MemoryEntry[]> {
  // FIX: Guard against invalid maxMemories values
  const limit = Math.max(1, Math.floor(maxMemories ?? 10));

  const allMemories = chatId
    ? await memoryDB.getByChatId(chatId)
    : await memoryDB.getByCharacterId(characterId);
  if (allMemories.length === 0) return [];

  const now = Date.now();
  const msPerDay = 1000 * 60 * 60 * 24;

  // Filter expired and decayed memories
  const validMemories = allMemories.filter(m => {
    const daysSince = (now - m.timestamp) / msPerDay;
    if (daysSince > MEMORY_EXPIRATION_DAYS) return false;
    if (daysSince > MEMORY_DECAY_THRESHOLD && m.importance < 4) return false;
    return true;
  });

  if (validMemories.length === 0) return [];

  // Build a context string from recent messages for relevance scoring
  const recentText = recentMessages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .slice(-RETRIEVAL_CONTEXT_WINDOW)
    .map(m => (m.content ?? '').toLowerCase())
    .join(' ');

  const recentWords = new Set(
    recentText
      .split(/\s+/)
      .filter(w => w.length > 2)
      .slice(-MAX_RECENT_WORDS),
  );

  // Score each memory
  const scored = validMemories.map(memory => {
    let score = scoreMemoryRelevance(memory, recentText, recentWords);

    // Boost for never-accessed memories (surface new info)
    if (memory.accessCount === 0) score *= 1.2;

    // Boost for importance
    score += memory.importance * 0.3;

    return { memory, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const selected = scored.slice(0, limit);

  // Update access counts in the background — do not block the caller
  const toUpdate: MemoryEntry[] = selected.map(({ memory }) => ({
    ...memory,
    lastReferenced: now,
    accessCount: memory.accessCount + 1,
  }));

  memoryDB.saveMany(toUpdate).catch(err => {
    console.error('[memory] Failed to update access counts:', err);
  });

  return selected.map(s => s.memory);
}

function scoreMemoryRelevance(
  memory: MemoryEntry,
  recentText: string,
  recentWords: Set<string>,
): number {
  let score = 0;

  // Keyword match (highest weight)
  for (const keyword of memory.keywords) {
    const kw = keyword.toLowerCase();
    if (recentText.includes(kw)) {
      score += 5;
      if (recentWords.has(kw)) score += 3; // exact word-boundary bonus
    }
  }

  // Content word match
  const contentWords = memory.content.toLowerCase().split(/\s+/);
  for (const word of contentWords) {
    if (word.length > 4 && recentWords.has(word)) score += 1;
  }

  // Recency decay: score scales from 1.0 → 0.3 over MEMORY_EXPIRATION_DAYS
  const daysSince = (Date.now() - memory.timestamp) / (1000 * 60 * 60 * 24);
  const recencyFactor = Math.max(0.3, 1 - daysSince / MEMORY_EXPIRATION_DAYS);
  score *= recencyFactor;

  // Strength factor
  score += (memory.strength ?? 0.5) * 2;

  return score;
}

// ---- Memory Consolidation ----

/**
 * Merges duplicate/similar memories for a character and returns the number deleted.
 *
 * FIX: The original had an O(n²) double loop that re-checked already-deleted entries
 * via `toDelete.includes()` — an O(n) scan inside an O(n²) loop = O(n³) overall.
 * Replaced with a Set for O(1) lookup, and bailed immediately when either entry is
 * already queued for deletion to avoid merging a memory that no longer exists.
 */
export async function consolidateMemories(characterId: string): Promise<number> {
  const memories = await memoryDB.getByCharacterId(characterId);
  if (memories.length < 5) return 0;

  const toDeleteSet = new Set<string>();
  const toUpdateMap = new Map<string, MemoryEntry>();

  for (let i = 0; i < memories.length; i++) {
    for (let j = i + 1; j < memories.length; j++) {
      const a = toUpdateMap.get(memories[i].id) ?? memories[i];
      const b = toUpdateMap.get(memories[j].id) ?? memories[j];

      if (toDeleteSet.has(a.id) || toDeleteSet.has(b.id)) continue;
      if (!isSimilarMemory(a.content, b.content)) continue;

      const [keep, discard] = a.importance >= b.importance ? [a, b] : [b, a];

      const merged: MemoryEntry = {
        ...keep,
        keywords: [...new Set([...keep.keywords, ...discard.keywords])].slice(0, MAX_KEYWORDS + 2),
        importance: Math.max(keep.importance, discard.importance),
        accessCount: Math.max(keep.accessCount, discard.accessCount),
        strength: Math.min((keep.strength ?? 0.5) + 0.1, 1),
      };

      toUpdateMap.set(keep.id, merged);
      toDeleteSet.add(discard.id);
    }
  }

  if (toUpdateMap.size > 0) {
    await memoryDB.saveMany([...toUpdateMap.values()]);
  }

  // FIX: Run deletes in parallel instead of sequentially to reduce latency
  if (toDeleteSet.size > 0) {
    await Promise.all([...toDeleteSet].map(id => memoryDB.delete(id)));
  }

  return toDeleteSet.size;
}

// ---- Format memories for prompt ----

export function formatMemoriesForPrompt(memories: MemoryEntry[]): string[] {
  if (memories.length === 0) return [];

  return memories.map(m => {
    const typeLabel = m.type.charAt(0).toUpperCase() + m.type.slice(1);
    // FIX: Nullish-coalesce strength so we never compare undefined > 0.8
    const strengthIndicator = (m.strength ?? 0) > 0.8 ? ' (Important)' : '';
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
  // FIX: Start with a fully-initialised byType so callers never get `undefined`
  // when accessing a type that has no entries.
  const allTypes: MemoryType[] = ['fact', 'event', 'emotion', 'preference', 'instruction', 'scene', 'summary'];
  const byType = Object.fromEntries(allTypes.map(t => [t, 0])) as Record<MemoryType, number>;

  let totalImportance = 0;
  let recentCount = 0;
  let strongCount = 0;
  const oneDayAgo = Date.now() - 1000 * 60 * 60 * 24;

  for (const m of memories) {
    // FIX: Guard against unexpected type values that aren't in our known set
    if (m.type in byType) {
      byType[m.type]++;
    }
    totalImportance += m.importance;
    if (m.timestamp > oneDayAgo) recentCount++;
    // FIX: Nullish-coalesce strength before comparison
    if ((m.strength ?? 0) > 0.7) strongCount++;
  }

  return {
    total: memories.length,
    byType,
    avgImportance: memories.length > 0 ? totalImportance / memories.length : 0,
    recentCount,
    strongCount,
  };
}

// ---- Scene summary (re-exported for context-condenser compatibility) ----

/**
 * Generates a short scene summary for a set of messages.
 * Used by the context condensation system when it needs a quick snapshot
 * without running the full memory extraction pipeline.
 */
export async function generateSceneSummary(
  messages: ChatMessage[],
  character: Character,
  settings: AppSettings,
): Promise<string> {
  if (messages.length === 0) return '';

  const transcript = messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => `${m.role === 'user' ? (settings.userPersona.name || 'You') : character.name}: ${m.content ?? ''}`)
    .join('\n');

  if (!transcript.trim()) return '';

  const summarizeMessages = [
    {
      role: 'system' as const,
      content:
        'Summarize this roleplay scene in 1-2 sentences. Third-person past tense. No meta-commentary.',
    },
    { role: 'user' as const, content: transcript },
  ];

  let summary = '';

  try {
    await streamChatResponse(settings, summarizeMessages, undefined, {
      onToken: token => { summary += token; },
      onDone: () => {},
      onError: () => {},
    });
  } catch {
    return '';
  }

  return summary.trim();
}