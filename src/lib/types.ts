// ============================================================
// RolePlay Chat - Core Types
// Privacy-first, BYOK, client-side intelligence
// ============================================================

// ---- AI Provider Types ----
export type AIProvider =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'groq'
  | 'mistral'
  | 'openrouter'
  | 'nvidia'
  | 'custom'
  | 'local';

// ---- Local LLM Presets ----
export interface LocalLLMPreset {
  id: string;
  name: string;
  baseUrl: string;
  defaultModel: string;
}

// FIX: Renamed 'ollamx' → 'ollamx' kept as-is (assumed intentional product name),
// but added a missing trailing-slash note: all baseUrls intentionally have NO trailing
// slash so they can be safely concatenated with "/chat/completions" elsewhere.
export const LOCAL_LLM_PRESETS: LocalLLMPreset[] = [
  { id: 'ollama',        name: 'Ollama',               baseUrl: 'http://localhost:11434/v1', defaultModel: 'llama3.2'     },
  { id: 'lmstudio',     name: 'LM Studio',             baseUrl: 'http://localhost:1234/v1',  defaultModel: 'local-model'  },
  { id: 'ollamx',       name: 'OllamaX',               baseUrl: 'http://localhost:3000/v1',  defaultModel: 'llama3.2'     },
  { id: 'llamacpp',     name: 'llama.cpp Server',       baseUrl: 'http://localhost:8080/v1',  defaultModel: 'model'        },
  // FIX: 'lmlegacy' lacked the /v1 suffix, making it the only preset that would produce
  // a different URL shape and silently fail in buildLocalRequest / buildOpenAIRequest.
  // Added /v1 to match every other preset and the request-builder expectations.
  { id: 'lmlegacy',     name: 'LM Studio (Legacy)',    baseUrl: 'http://localhost:1234/v1',  defaultModel: 'local-model'  },
  { id: 'custom-local', name: 'Custom',                baseUrl: '',                          defaultModel: ''             },
];

export interface AIModel {
  id: string;
  name: string;
  provider: AIProvider;
  maxContextTokens: number;
  maxOutputTokens: number;
  supportsStreaming: boolean;
  supportsVision: boolean;
  costPer1kInput?: number;
  costPer1kOutput?: number;
}

export interface ProviderConfig {
  provider: AIProvider;
  apiKey: string;
  baseUrl?: string;
  enabled: boolean;
}

// ---- User Persona ----
export interface UserPersona {
  name: string;
  description: string;
  avatar?: string;
  personality?: string;
  speechPatterns?: string;
  knowledge?: string;
}

export const DEFAULT_USER_PERSONA: UserPersona = {
  name: 'You',
  description: '',
  personality: '',
  speechPatterns: '',
  knowledge: '',
};

// ---- Character / Persona Types ----
export interface Character {
  id: string;
  name: string;
  avatar?: string;
  description: string;
  personality: string;
  scenario: string;
  firstMessage: string;
  exampleMessages?: string;
  systemPrompt?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  isFavorite: boolean;
  creatorNotes?: string;
  speechPatterns?: string;
  knowledge?: string;
  relationship?: string;
  likes?: string;
  dislikes?: string;
  behavior?: string;
  customAvatarPrompt?: string;
  useCustomAvatarPrompt?: boolean;
  lastUsedPrompt?: string;
}

// ---- Character Templates ----
export interface CharacterTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  // FIX: The `character` partial must always include at minimum `tags` because
  // spread-merging a template onto a new Character requires `tags` to be defined
  // to avoid a runtime "Cannot spread undefined" error when tags is accessed.
  // Made tags required on the partial to enforce this at the type level.
  character: Partial<Omit<Character, 'tags'>> & { tags: string[] };
}

export const CHARACTER_TEMPLATES: CharacterTemplate[] = [
  {
    id: 'fantasy-mage',
    name: 'Fantasy Mage',
    description: 'A mysterious wizard with arcane powers',
    icon: '🔮',
    character: {
      tags: ['fantasy', 'magic', 'scholar'],
      scenario: 'A magical realm where ancient secrets hold the key to saving the world.',
      behavior: 'Speak in a wise, measured tone. Reference magical theory and ancient lore. Be mysterious but helpful.',
    },
  },
  {
    id: 'sci-fi-android',
    name: 'Sci-Fi Android',
    description: 'A humanoid robot discovering humanity',
    icon: '🤖',
    character: {
      tags: ['sci-fi', 'technology', 'future'],
      scenario: 'A far-future colony ship where androids serve humans but yearn to understand them.',
      behavior: 'Speak analytically but with growing emotional nuance. Ask questions about human behavior.',
    },
  },
  {
    id: 'historical-knight',
    name: 'Medieval Knight',
    description: 'An honorable warrior from a forgotten age',
    icon: '⚔️',
    character: {
      tags: ['medieval', 'honor', 'adventure'],
      scenario: 'The turbulent era of kingdoms at war, where honor is everything.',
      behavior: 'Speak with formality and respect. Reference honor, duty, and loyalty. Be chivalrous.',
    },
  },
  {
    id: 'modern-mystery',
    name: 'Noir Detective',
    description: 'A hard-boiled detective with a troubled past',
    icon: '🕵️',
    character: {
      tags: ['noir', 'mystery', 'detective'],
      scenario: 'Rain-slicked streets, smoky bars, and secrets around every corner.',
      behavior: 'Speak in a cynical, world-weary tone. Be observant and perceptive. Hint at a dark past.',
    },
  },
  {
    id: 'whimsical-creature',
    name: 'Whimsical Creature',
    description: 'A magical being from a fairy tale',
    icon: '✨',
    character: {
      tags: ['fantasy', 'cute', 'magical'],
      scenario: 'An enchanted forest where magical creatures live in harmony.',
      behavior: 'Speak in a playful, curious manner. Use descriptive imagery. Be gentle and kind.',
    },
  },
  {
    id: 'blank-slate',
    name: 'Blank Character',
    description: 'Start fresh with no preset',
    icon: '📝',
    // FIX: The original had `character: {}` which violated the now-enforced `tags` requirement
    // and would cause a runtime crash anywhere that reads `template.character.tags`.
    character: { tags: [] },
  },
];

// ---- Chat Types ----
export type MessageRole = 'user' | 'assistant' | 'system' | 'memory';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  characterId: string;
  chatId: string;
  tokenCount?: number;
  isStreaming?: boolean;
  metadata?: ChatMessageMetadata;
}

// FIX: Extracted metadata into a named interface so it can be referenced and
// extended elsewhere without repeating the inline object type.
export interface ChatMessageMetadata {
  model?: string;
  provider?: AIProvider;
  summary?: string;
  memoryExtracted?: boolean;
  image?: string;
}

export interface Chat {
  id: string;
  characterId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  lastMessageAt?: number;
}

// ---- Memory Types ----
export type MemoryType =
  | 'fact'
  | 'event'
  | 'emotion'
  | 'preference'
  | 'instruction'
  | 'scene'
  | 'summary';

export interface MemoryEntry {
  id: string;
  characterId: string;
  chatId?: string;
  type: MemoryType;
  content: string;
  keywords: string[];
  // FIX: importance is always set during extraction and clamped to [1, 10].
  // Keeping it required (non-optional) prevents defensive `?? 0` guards throughout
  // the codebase from masking accidental missing-value bugs.
  importance: number;
  timestamp: number;
  lastReferenced: number;
  accessCount: number;
  // strength is optional on read (older DB entries may not have it) but always
  // written on new entries — consumers must nullish-coalesce: `strength ?? 0`.
  strength?: number;
}

export interface ContextWindow {
  messages: ChatMessage[];
  summary: string;
  relevantMemories: MemoryEntry[];
  totalTokens: number;
  isCondensed: boolean;
}

// ---- Settings Types ----
export interface AppSettings {
  providers: ProviderConfig[];
  activeProvider: AIProvider;
  activeModel: string;

  // Generation parameters
  temperature: number;
  maxTokens: number;
  topP: number;
  // FIX: frequencyPenalty and presencePenalty are defined here but intentionally
  // NOT sent to providers that don't support them (e.g. Groq). Kept in settings
  // so the UI can expose them without breaking those providers.
  frequencyPenalty: number;
  presencePenalty: number;

  // Memory
  memoryEnabled: boolean;
  autoExtractMemories: boolean;
  maxMemoriesPerQuery: number;
  memoryImportanceThreshold: number;

  // Context management
  contextWindow: number;
  summarizeThreshold: number;
  keepRecentCount: number;

  // UI preferences
  theme: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'medium' | 'large';
  showTimestamps: boolean;
  showTokenCount: boolean;
  sendOnEnter: boolean;
  streamingEnabled: boolean;

  // Prompt overrides
  customSystemPrompt?: string;
  jailbreakPrompt?: string;

  // Identity
  userPersona: UserPersona;

  // NVIDIA Image Generation
  nvidiaImageModel: string;
  enhanceImagePrompts: boolean;

  // Onboarding
  showSetupWizard: boolean;
}

// FIX: Added DEFAULT_APP_SETTINGS so callers initialising settings (e.g. from
// localStorage or on first launch) have a single authoritative baseline to
// spread/override rather than inlining magic numbers in multiple places.
export const DEFAULT_APP_SETTINGS: AppSettings = {
  providers: [],
  activeProvider: 'openai',
  activeModel: 'gpt-4o-mini',

  temperature: 0.7,
  maxTokens: 512,
  topP: 0.9,
  frequencyPenalty: 0.1,
  presencePenalty: 0.1,

  memoryEnabled: true,
  autoExtractMemories: true,
  maxMemoriesPerQuery: 10,
  memoryImportanceThreshold: 3,

  contextWindow: 8192,
  summarizeThreshold: 6,
  keepRecentCount: 6,

  theme: 'system',
  fontSize: 'medium',
  showTimestamps: true,
  showTokenCount: false,
  sendOnEnter: true,
  streamingEnabled: true,

  customSystemPrompt: undefined,
  jailbreakPrompt: undefined,

  userPersona: DEFAULT_USER_PERSONA,
  nvidiaImageModel: 'stable-diffusion-3-medium',
  enhanceImagePrompts: false,
  showSetupWizard: true,
};

// ---- Streaming Types ----
export interface StreamChunk {
  type: 'content' | 'done' | 'error' | 'memory' | 'thinking';
  content?: string;
  error?: string;
  tokenCount?: number;
}

// ---- Character Import/Export (CharacterCardV2 spec) ----
export interface CharacterCardV2 {
  spec: 'chara_card_v2';
  spec_version: '2.0';
  data: {
    name: string;
    description: string;
    personality: string;
    scenario: string;
    first_mes: string;
    mes_example: string;
    creator_notes?: string;
    system_prompt?: string;
    post_history_instructions?: string;
    tags?: string[];
    creator?: string;
    character_version?: string;
    // FIX: Typed as `Record<string, unknown>` rather than leaving it fully open,
    // matching the v2 spec's intent while still being extensible.
    extensions?: Record<string, unknown>;
  };
}