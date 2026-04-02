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

export const LOCAL_LLM_PRESETS: LocalLLMPreset[] = [
  { id: 'ollama', name: 'Ollama', baseUrl: 'http://localhost:11434/v1', defaultModel: 'llama3.2' },
  { id: 'lmstudio', name: 'LM Studio', baseUrl: 'http://localhost:1234/v1', defaultModel: 'local-model' },
  { id: 'ollamx', name: 'OllamaX', baseUrl: 'http://localhost:3000/v1', defaultModel: 'llama3.2' },
  { id: 'llamacpp', name: 'llama.cpp Server', baseUrl: 'http://localhost:8080/v1', defaultModel: 'model' },
  { id: 'lmlegacy', name: 'LM Studio (Legacy)', baseUrl: 'http://localhost:1234', defaultModel: 'local-model' },
  { id: 'custom-local', name: 'Custom', baseUrl: '', defaultModel: '' },
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

// ---- User Persona (for roleplay) ----
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
}

// ---- Character Templates ----
export interface CharacterTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  character: Partial<Character>;
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
      behavior: 'Speak in an wise, measured tone. Reference magical theory and ancient lore. Be mysterious but helpful.',
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
    character: {},
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
  metadata?: {
    model?: string;
    provider?: AIProvider;
    summary?: string;
    memoryExtracted?: boolean;
  };
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
export interface MemoryEntry {
  id: string;
  characterId: string;
  chatId?: string;
  type: MemoryType;
  content: string;
  keywords: string[];
  importance: number;
  timestamp: number;
  lastReferenced: number;
  accessCount: number;
  strength?: number;
}

export type MemoryType =
  | 'fact'
  | 'event'
  | 'emotion'
  | 'preference'
  | 'instruction'
  | 'scene'
  | 'summary';

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
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  memoryEnabled: boolean;
  autoExtractMemories: boolean;
  maxMemoriesPerQuery: number;
  memoryImportanceThreshold: number;
  contextWindow: number;
  summarizeThreshold: number;
  keepRecentCount: number;
  theme: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'medium' | 'large';
  showTimestamps: boolean;
  showTokenCount: boolean;
  sendOnEnter: boolean;
  streamingEnabled: boolean;
  customSystemPrompt?: string;
  jailbreakPrompt?: string;
  userPersona: UserPersona;
  showSetupWizard: boolean;
}

// ---- Streaming Types ----
export interface StreamChunk {
  type: 'content' | 'done' | 'error' | 'memory' | 'thinking';
  content?: string;
  error?: string;
  tokenCount?: number;
}

// ---- Character Import/Export ----
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
    extensions?: Record<string, unknown>;
  };
}
