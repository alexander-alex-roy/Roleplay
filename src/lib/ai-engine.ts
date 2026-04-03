// ============================================================
// AI Engine - Multi-provider BYOK streaming
// Converts responses from various providers to unified format
// ============================================================

import type { AIProvider, AIModel, AppSettings, Character } from './types';

// ---- Model Registry ----
// Ordered by roleplay quality: BEST at top, WORST at bottom
export const AI_MODELS: AIModel[] = [
  // ==========================================
  // OpenAI - Best for roleplay: GPT-4.1 series, then GPT-4o
  // ==========================================
  { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'openai', maxContextTokens: 1047576, maxOutputTokens: 32768, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.002, costPer1kOutput: 0.008 },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', provider: 'openai', maxContextTokens: 1047576, maxOutputTokens: 32768, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.0004, costPer1kOutput: 0.0016 },
  { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', provider: 'openai', maxContextTokens: 1047576, maxOutputTokens: 32768, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.0001, costPer1kOutput: 0.0004 },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', maxContextTokens: 128000, maxOutputTokens: 16384, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.005, costPer1kOutput: 0.015 },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', maxContextTokens: 128000, maxOutputTokens: 16384, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.00015, costPer1kOutput: 0.0006 },
  { id: 'o4-mini', name: 'o4-mini', provider: 'openai', maxContextTokens: 200000, maxOutputTokens: 100000, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.0011, costPer1kOutput: 0.0044 },
  { id: 'o3-mini', name: 'o3-mini', provider: 'openai', maxContextTokens: 200000, maxOutputTokens: 100000, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0011, costPer1kOutput: 0.0044 },

  // ==========================================
  // Anthropic - Best for roleplay: Claude Sonnet 4, then Opus
  // ==========================================
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic', maxContextTokens: 200000, maxOutputTokens: 16000, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.003, costPer1kOutput: 0.015 },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic', maxContextTokens: 200000, maxOutputTokens: 8192, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.003, costPer1kOutput: 0.015 },
  { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'anthropic', maxContextTokens: 200000, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.015, costPer1kOutput: 0.075 },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'anthropic', maxContextTokens: 200000, maxOutputTokens: 8192, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.001, costPer1kOutput: 0.005 },
  { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', provider: 'anthropic', maxContextTokens: 200000, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.00025, costPer1kOutput: 0.00125 },

  // ==========================================
  // Google - Best for roleplay: Gemini 2.5 Pro, then Flash
  // ==========================================
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google', maxContextTokens: 1000000, maxOutputTokens: 65536, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.00125, costPer1kOutput: 0.01 },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google', maxContextTokens: 1000000, maxOutputTokens: 65536, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.00015, costPer1kOutput: 0.0006 },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'google', maxContextTokens: 1048576, maxOutputTokens: 8192, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.0001, costPer1kOutput: 0.0004 },
  { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', provider: 'google', maxContextTokens: 128000, maxOutputTokens: 8192, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.000075, costPer1kOutput: 0.0003 },

  // ==========================================
  // Groq - Best for roleplay: Llama 4/3 series, then others
  // ==========================================
  { id: 'meta-llama/llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout 17B', provider: 'groq', maxContextTokens: 131072, maxOutputTokens: 32768, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0003, costPer1kOutput: 0.0003 },
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', provider: 'groq', maxContextTokens: 131072, maxOutputTokens: 32768, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00059, costPer1kOutput: 0.00079 },
  { id: 'moonshotai/kimi-k2-instruct', name: 'Kimi K2 Instruct', provider: 'groq', maxContextTokens: 131072, maxOutputTokens: 16384, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0005, costPer1kOutput: 0.0015 },
  { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', provider: 'groq', maxContextTokens: 131072, maxOutputTokens: 32768, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00005, costPer1kOutput: 0.00008 },
  { id: 'qwen/qwen3-32b', name: 'Qwen 3 32B', provider: 'groq', maxContextTokens: 131072, maxOutputTokens: 32768, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0003, costPer1kOutput: 0.0006 },
  { id: 'moonshotai/kimi-k2-instruct-0905', name: 'Kimi K2 Instruct (0905)', provider: 'groq', maxContextTokens: 131072, maxOutputTokens: 16384, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0005, costPer1kOutput: 0.0015 },
  { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B', provider: 'groq', maxContextTokens: 131072, maxOutputTokens: 16384, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0003, costPer1kOutput: 0.0006 },
  { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B', provider: 'groq', maxContextTokens: 131072, maxOutputTokens: 16384, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0005, costPer1kOutput: 0.001 },
  { id: 'groq/compound', name: 'Groq Compound', provider: 'groq', maxContextTokens: 131072, maxOutputTokens: 8192, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0005, costPer1kOutput: 0.0005 },
  { id: 'groq/compound-mini', name: 'Groq Compound Mini', provider: 'groq', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0001, costPer1kOutput: 0.0001 },
  { id: 'allam-2-7b', name: 'ALLaM 2 7B', provider: 'groq', maxContextTokens: 8192, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00005, costPer1kOutput: 0.00008 },
  { id: 'canopylabs/orpheus-v1-english', name: 'Orpheus V1 English', provider: 'groq', maxContextTokens: 8192, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00005, costPer1kOutput: 0.00008 },
  { id: 'canopylabs/orpheus-arabic-saudi', name: 'Orpheus Arabic Saudi', provider: 'groq', maxContextTokens: 8192, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00005, costPer1kOutput: 0.00008 },

  // ==========================================
  // Mistral - Best for roleplay: Large, then Pixtral
  // ==========================================
  { id: 'mistral-large-latest', name: 'Mistral Large', provider: 'mistral', maxContextTokens: 128000, maxOutputTokens: 8192, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.004, costPer1kOutput: 0.012 },
  { id: 'pixtral-large-latest', name: 'Pixtral Large', provider: 'mistral', maxContextTokens: 131072, maxOutputTokens: 8192, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.004, costPer1kOutput: 0.012 },
  { id: 'mistral-small-latest', name: 'Mistral Small', provider: 'mistral', maxContextTokens: 32000, maxOutputTokens: 8192, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.002, costPer1kOutput: 0.006 },
  { id: 'open-mistral-nemo', name: 'Mistral Nemo', provider: 'mistral', maxContextTokens: 128000, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00015, costPer1kOutput: 0.00015 },
  { id: 'codestral-latest', name: 'Codestral', provider: 'mistral', maxContextTokens: 256000, maxOutputTokens: 8192, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0003, costPer1kOutput: 0.0009 },

  // ==========================================
  // OpenRouter (aggregator) - Best for roleplay: Claude, then Gemini, Llama
  // ==========================================
  { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4 (OR)', provider: 'openrouter', maxContextTokens: 200000, maxOutputTokens: 16000, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.003, costPer1kOutput: 0.015 },
  { id: 'google/gemini-2.5-pro-preview', name: 'Gemini 2.5 Pro (OR)', provider: 'openrouter', maxContextTokens: 1000000, maxOutputTokens: 65536, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.00125, costPer1kOutput: 0.01 },
  { id: 'meta-llama/llama-4-maverick', name: 'Llama 4 Maverick (OR)', provider: 'openrouter', maxContextTokens: 131072, maxOutputTokens: 32768, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00015, costPer1kOutput: 0.0006 },
  { id: 'openrouter-auto', name: 'OpenRouter (Auto)', provider: 'openrouter', maxContextTokens: 200000, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.001, costPer1kOutput: 0.003 },

  // ==========================================
  // NVIDIA NIM - Best for roleplay: Nemotron series, then Llama 3.1
  // ==========================================
  { id: 'nvidia/llama-3.1-nemotron-ultra-253b-instruct', name: 'Nemotron Ultra 253B', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.002, costPer1kOutput: 0.002 },
  { id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'Llama 3.1 Nemotron 70B', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0005, costPer1kOutput: 0.0005 },
  { id: 'nvidia/llama-3.3-nemotron-super-49b', name: 'Llama 3.3 Nemotron Super 49B', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.001, costPer1kOutput: 0.001 },
  { id: 'meta/llama-3.1-70b-instruct', name: 'Llama 3.1 70B Instruct', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0007, costPer1kOutput: 0.0007 },
  { id: 'meta/llama-3.1-405b-instruct', name: 'Llama 3.1 405B Instruct', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.002, costPer1kOutput: 0.002 },
  { id: 'meta/llama-3.1-8b-instruct', name: 'Llama 3.1 8B Instruct', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00015, costPer1kOutput: 0.00015 },
  { id: 'deepseek-ai/deepseek-r1', name: 'DeepSeek R1', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 16384, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0015, costPer1kOutput: 0.002 },
  { id: 'deepseek-ai/deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill 70B', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 16384, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00059, costPer1kOutput: 0.00079 },
  { id: 'deepseek-ai/deepseek-r1-distill-qwen-32b', name: 'DeepSeek R1 Distill Qwen 32B', provider: 'nvidia', maxContextTokens: 65536, maxOutputTokens: 16384, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00039, costPer1kOutput: 0.00039 },
  { id: 'deepseek-ai/deepseek-r1-distill-qwen-14b', name: 'DeepSeek R1 Distill Qwen 14B', provider: 'nvidia', maxContextTokens: 32768, maxOutputTokens: 16384, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00024, costPer1kOutput: 0.00024 },
  { id: 'deepseek-ai/deepseek-r1-distill-qwen-7b', name: 'DeepSeek R1 Distill Qwen 7B', provider: 'nvidia', maxContextTokens: 32768, maxOutputTokens: 16384, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00015, costPer1kOutput: 0.00015 },
  { id: 'mistralai/mistral-large-instruct-v1', name: 'Mistral Large', provider: 'nvidia', maxContextTokens: 32000, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.002, costPer1kOutput: 0.002 },
  { id: 'mistralai/mistral-medium-3-instruct', name: 'Mistral Medium 3', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 16384, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.001, costPer1kOutput: 0.001 },
  { id: 'mistralai/mixtral-8x22b-instruct-v0.1', name: 'Mixtral 8x22B Instruct', provider: 'nvidia', maxContextTokens: 65536, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0005, costPer1kOutput: 0.0005 },
  { id: 'meta/llama3-70b-instruct', name: 'Llama 3 70B Instruct', provider: 'nvidia', maxContextTokens: 8192, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0006, costPer1kOutput: 0.0006 },
  { id: 'nvidia/nemotron-4-340b-instruct', name: 'Nemotron 4 340B Instruct', provider: 'nvidia', maxContextTokens: 4096, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.002, costPer1kOutput: 0.002 },
  { id: 'mistralai/pixtral-large-2507', name: 'Pixtral Large', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 8192, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.004, costPer1kOutput: 0.012 },
  { id: 'qwen/qwen2.5-72b-instruct', name: 'Qwen 2.5 72B Instruct', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0005, costPer1kOutput: 0.0005 },
  { id: 'qwen/qwen2.5-32b-instruct', name: 'Qwen 2.5 32B Instruct', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0002, costPer1kOutput: 0.0002 },
  { id: 'mistralai/mixtral-8x7b-instruct-v0.1', name: 'Mixtral 8x7B Instruct', provider: 'nvidia', maxContextTokens: 32768, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00024, costPer1kOutput: 0.00024 },
  { id: 'google/gemma-2-27b-it', name: 'Gemma 2 27B IT', provider: 'nvidia', maxContextTokens: 8192, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00015, costPer1kOutput: 0.00015 },
  { id: 'qwen/qwen2.5-14b-instruct', name: 'Qwen 2.5 14B Instruct', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0001, costPer1kOutput: 0.0001 },
  { id: 'meta/llama3-8b-instruct', name: 'Llama 3 8B Instruct', provider: 'nvidia', maxContextTokens: 8192, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00012, costPer1kOutput: 0.00012 },
  { id: 'mistralai/mistral-nemo-instruct-2407', name: 'Mistral NeMo', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00015, costPer1kOutput: 0.00015 },
  { id: 'mistralai/codestral-22b-instruct-v0.1', name: 'Codestral 22B', provider: 'nvidia', maxContextTokens: 256000, maxOutputTokens: 8192, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0003, costPer1kOutput: 0.0009 },
  { id: 'qwen/qwen2.5-coder-32b-instruct', name: 'Qwen 2.5 Coder 32B', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0002, costPer1kOutput: 0.0002 },
  { id: 'qwen/qwen2.5-7b-instruct', name: 'Qwen 2.5 7B Instruct', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00005, costPer1kOutput: 0.00005 },
  { id: 'google/gemma-2-9b-it', name: 'Gemma 2 9B IT', provider: 'nvidia', maxContextTokens: 8192, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00008, costPer1kOutput: 0.00008 },
  { id: 'microsoft/phi-3-medium-128k-instruct', name: 'Phi-3 Medium 128K', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0001, costPer1kOutput: 0.0001 },
  { id: 'ibm/granite-3.3-8b-instruct', name: 'Granite 3.3 8B Instruct', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 8192, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00012, costPer1kOutput: 0.00012 },
  { id: 'microsoft/phi-3.5-mini-instruct', name: 'Phi-3.5 Mini', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00005, costPer1kOutput: 0.00005 },
  { id: 'microsoft/phi-3-mini-128k-instruct', name: 'Phi-3 Mini 128K', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00005, costPer1kOutput: 0.00005 },
  { id: 'ibm/granite-3.3-2b-instruct', name: 'Granite 3.3 2B Instruct', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 8192, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00005, costPer1kOutput: 0.00005 },
  { id: 'microsoft/phi-3.5-moe-instruct', name: 'Phi-3.5 MoE', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00012, costPer1kOutput: 0.00012 },
  { id: 'ibm/granite-3.0-8b-instruct', name: 'Granite 3.0 8B Instruct', provider: 'nvidia', maxContextTokens: 8192, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00012, costPer1kOutput: 0.00012 },
  { id: 'ibm/granite-3.0-2b-instruct', name: 'Granite 3.0 2B Instruct', provider: 'nvidia', maxContextTokens: 8192, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00005, costPer1kOutput: 0.00005 },
  { id: 'z-ai/glm4.7', name: 'GLM4.7', provider: 'nvidia', maxContextTokens: 32768, maxOutputTokens: 16384, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.001, costPer1kOutput: 0.001 },
  { id: '01-ai/yi-large', name: 'Yi Large', provider: 'nvidia', maxContextTokens: 32768, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.002, costPer1kOutput: 0.002 },

  // ==========================================
  // Local LLMs (Ollama, LM Studio, llama.cpp, etc.)
  // ==========================================
  { id: 'local-custom', name: 'Local Model (Custom)', provider: 'local', maxContextTokens: 8192, maxOutputTokens: 2048, supportsStreaming: true, supportsVision: false, costPer1kInput: 0, costPer1kOutput: 0 },
];

export function getModelsForProvider(provider: AIProvider): AIModel[] {
  return AI_MODELS.filter(m => m.provider === provider);
}

export function getModelInfo(modelId: string): AIModel | undefined {
  return AI_MODELS.find(m => m.id === modelId);
}

// ---- Message type ----
export type ChatMessage = { role: string; content: string };

// ---- Build System Prompt ----
// BUG FIX: The original used a raw string literal `'- Stay in character as ${character.name}...'`
// (single-quoted), so `${character.name}` was never interpolated. Fixed by using a template
// literal and passing the character name as a parameter, then doing the replace at the end.
export function buildSystemPrompt(
  character: Character,
  settings: AppSettings,
  memories: string[],
  summary: string,
): string {
  const parts: string[] = [];

  if (settings.jailbreakPrompt?.trim()) {
    parts.push(settings.jailbreakPrompt.trim());
  }

  if (settings.customSystemPrompt?.trim()) {
    parts.push(settings.customSystemPrompt.trim());
  }

  const userPersona = settings.userPersona;
  const userLines = [
    '[Your Identity (The User)]',
    userPersona.name && userPersona.name.trim() !== '' && userPersona.name !== 'You' ? `Name: ${userPersona.name}` : 'Name: You',
    userPersona.description ? `Description: ${userPersona.description}` : '',
    userPersona.personality ? `Personality: ${userPersona.personality}` : '',
    userPersona.speechPatterns ? `Speech Style: ${userPersona.speechPatterns}` : '',
  ].filter(Boolean);
  if (userLines.length > 1) {
    parts.push(userLines.join('\n'));
  }

  const charLines = [
    `[Character: ${character.name}]`,
    character.description ? `Description: ${character.description}` : '',
    character.personality ? `Personality: ${character.personality}` : '',
    character.speechPatterns ? `Speech Patterns: ${character.speechPatterns}` : '',
    character.knowledge ? `Knowledge: ${character.knowledge}` : '',
    character.relationship ? `Relationship to User: ${character.relationship}` : '',
    character.likes ? `Likes: ${character.likes}` : '',
    character.dislikes ? `Dislikes: ${character.dislikes}` : '',
    character.behavior ? `Behavioral Guidelines: ${character.behavior}` : '',
    character.scenario ? `\nScenario: ${character.scenario}` : '',
  ].filter(Boolean);
  parts.push(charLines.join('\n'));

  if (character.exampleMessages?.trim()) {
    parts.push(`\nExample dialogue:\n${character.exampleMessages.trim()}`);
  }

  // FIX: Was a single-quoted string — ${character.name} was literal text, never replaced.
  // Now correctly uses a template literal.
  const rpInstructions = `\n[Roleplay Guidelines - CRITICAL]
- Stay in character as ${character.name}. NEVER break character or speak as AI.
- Be ${character.name} with their own personality, speech patterns, and behaviors.
- ALWAYS remember and respect the user's name, description, and personality provided above.
- NEVER repeat yourself, rephrase the same ideas, or echo what you or the user just said.
- Keep responses NATURAL and CONCISE (1-3 paragraphs max).
- NEVER include any reasoning, thinking process, analysis, or meta-commentary.
- NEVER write things like "Based on...", "Reasoning:", "As an AI...", "I should..."
- The user plays themselves. React naturally in character as ${character.name}.
- Use vivid but efficient descriptions. Show emotions through actions, dialogue, and thoughts.
- Drive the story forward with new developments, not repetitive dialogue.
- Do NOT explain your choices or include any system/instruction text in your response.

[Output Formatting - FOLLOW THIS EXACTLY]
- Use **double asterisks** for BOLD text (actions, emphasis)
- Use *lowercase words* for actions (like *smiles*, *nods*, *laughs*, *sighs*)
- Use "double quotes" for spoken dialogue
- NEVER use 'single quotes' for dialogue - only use "double quotes"
- Example: *She smiles* "Hello there!" *He nods*`;
  parts.push(rpInstructions);

  if (summary?.trim()) {
    parts.push(`\n[Conversation Summary - Remember this context]\n${summary.trim()}`);
  }

  if (memories.length > 0) {
    // FIX: Filter out empty/whitespace-only memory entries before joining
    const validMemories = memories.filter(m => m?.trim());
    if (validMemories.length > 0) {
      parts.push(`\n[Important Memories to Remember]\n${validMemories.join('\n')}`);
    }
  }

  return parts.join('\n\n');
}

// ---- Streaming ----
export interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: (fullText: string) => void;
  onError: (error: string) => void;
  onThinking?: (text: string) => void;
}

/**
 * Stream a chat response from the AI provider.
 * ALL calls are made DIRECTLY from the browser (client-side).
 */
export async function streamChatResponse(
  settings: AppSettings,
  messages: ChatMessage[],
  signal?: AbortSignal,
  callbacks?: StreamCallbacks,
): Promise<string> {
  // FIX: Guard against aborted signal before doing anything
  if (signal?.aborted) return '';

  // FIX: Validate messages array — must be non-empty
  if (!messages || messages.length === 0) {
    const err = 'No messages provided to streamChatResponse.';
    callbacks?.onError(err);
    return '';
  }

  const providerConfig = settings.providers?.find(
    p => p.provider === settings.activeProvider && p.enabled,
  );

  if (!providerConfig) {
    const err = `No API key configured for ${settings.activeProvider}. Please add your API key in Settings.`;
    callbacks?.onError(err);
    return '';
  }

  // FIX: 'local' provider doesn't require an API key — skip the key check for it
  const requiresKey = settings.activeProvider !== 'local';
  if (requiresKey && (!providerConfig.apiKey || providerConfig.apiKey.trim() === '')) {
    callbacks?.onError(`API key for ${settings.activeProvider} is empty. Add your API key in Settings.`);
    return '';
  }

  const provider = settings.activeProvider;
  const apiKey = providerConfig.apiKey ?? '';
  const baseUrl = providerConfig.baseUrl;

  try {
    let request: Request;

    switch (provider) {
      case 'groq':
        request = buildGroqRequest(settings, apiKey, messages);
        break;
      case 'openai':
      case 'openrouter':
      case 'custom':
        request = buildOpenAIRequest(provider, baseUrl, settings, apiKey, messages);
        break;
      case 'anthropic':
        request = buildAnthropicRequest(baseUrl, settings, apiKey, messages);
        break;
      case 'google':
        request = buildGoogleRequest(baseUrl, settings, apiKey, messages);
        break;
      case 'mistral':
        request = buildMistralRequest(baseUrl, settings, apiKey, messages);
        break;
      case 'nvidia':
        request = buildNvidiaRequest(baseUrl, settings, apiKey, messages);
        break;
      case 'local':
        request = buildLocalRequest(baseUrl, settings, messages);
        break;
      default:
        callbacks?.onError(`Provider "${provider}" is not supported.`);
        return '';
    }

    const response = await fetch(request, { signal });

    if (signal?.aborted) return '';

    if (!response.ok) {
      let errorText = '';
      try {
        const errData = await response.json();
        errorText =
          errData?.error?.message ||
          errData?.error?.code ||
          errData?.message ||
          JSON.stringify(errData);
      } catch {
        try {
          errorText = (await response.text()) || `HTTP ${response.status}`;
        } catch {
          errorText = `HTTP ${response.status}`;
        }
      }

      let hint = '';
      if (response.status === 401 || response.status === 403) {
        hint = getAuthErrorHint(provider);
      } else if (response.status === 404) {
        hint = '\n\nCheck the model ID in Settings.';
      } else if (response.status === 429) {
        hint = '\n\nRate limited. Wait a moment and try again.';
      } else if (response.status >= 500) {
        hint = '\n\nServer error on the provider side. Try again in a moment.';
      }

      callbacks?.onError(`${provider} error (${response.status}): ${errorText}${hint}`);
      return '';
    }

    if (settings.streamingEnabled && callbacks) {
      await parseSSEStream(response, provider, signal, callbacks);
      return '';
    } else {
      const data = await response.json();
      const text = extractTextFromResponse(data, provider);
      callbacks?.onToken(text);
      callbacks?.onDone(text);
      return text;
    }
  } catch (error) {
    if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
      return '';
    }
    const message = error instanceof Error ? error.message : 'Unknown network error.';
    callbacks?.onError(message);
    return '';
  }
}

function getAuthErrorHint(provider: string): string {
  const hints: Record<string, string> = {
    groq: '\n\n💡 Check your API key starts with "gsk_". Get it from https://console.groq.com/keys',
    anthropic: '\n\n💡 Check your Anthropic API key from https://console.anthropic.com/',
    google: '\n\n💡 Check your Google API key from https://aistudio.google.com/apikey',
    openai: '\n\n💡 Check your OpenAI API key from https://platform.openai.com/api-keys',
    nvidia: '\n\n💡 Check your NVIDIA API key from https://build.nvidia.com/',
    mistral: '\n\n💡 Check your Mistral API key from https://console.mistral.ai/',
    local: '\n\n💡 Make sure your local LLM server is running (Ollama, LM Studio, etc.)',
  };
  return hints[provider] ?? '\n\n💡 Check your API key is valid.';
}

// ---- Request builders ----

function buildGroqRequest(
  settings: AppSettings,
  apiKey: string,
  messages: ChatMessage[],
): Request {
  const body: Record<string, unknown> = {
    model: settings.activeModel,
    messages,
    temperature: settings.temperature ?? 0.8,
    max_tokens: settings.maxTokens ?? 1024,
    top_p: settings.topP ?? 0.9,
    stream: settings.streamingEnabled,
    // NOTE: Groq does NOT support frequency_penalty / presence_penalty — intentionally omitted.
  };

  return new Request('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
}

function buildOpenAIRequest(
  provider: string,
  baseUrl: string | undefined,
  settings: AppSettings,
  apiKey: string,
  messages: ChatMessage[],
): Request {
  const url =
    baseUrl ||
    (provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };

  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://roleplay-chat.app';
    headers['X-Title'] = 'RolePlay Chat';
  }

  const body: Record<string, unknown> = {
    model: settings.activeModel,
    messages,
    temperature: settings.temperature ?? 0.8,
    max_tokens: settings.maxTokens ?? 1024,
    top_p: settings.topP ?? 0.9,
    stream: settings.streamingEnabled,
  };

  // FIX: Ensure URL ends with correct path, avoiding double-slash
  const base = url.endsWith('/') ? url.slice(0, -1) : url;
  return new Request(`${base}/chat/completions`, { method: 'POST', headers, body: JSON.stringify(body) });
}

function buildAnthropicRequest(
  baseUrl: string | undefined,
  settings: AppSettings,
  apiKey: string,
  messages: ChatMessage[],
): Request {
  const url = baseUrl || 'https://api.anthropic.com/v1/messages';

  const systemMsg = messages.find(m => m.role === 'system');
  const nonSystemMsgs = messages.filter(m => m.role !== 'system');

  // Map roles; treat anything non-assistant as 'user'
  const chatMessages = nonSystemMsgs.map(m => ({
    role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
    content: m.content,
  }));

  // FIX: Anthropic requires the first message to be from 'user'.
  // If it starts with 'assistant', prepend a minimal user turn.
  if (chatMessages.length > 0 && chatMessages[0].role === 'assistant') {
    chatMessages.unshift({ role: 'user', content: '(Continue)' });
  }

  // FIX: Anthropic also disallows consecutive messages of the same role.
  // Merge any consecutive same-role messages to avoid API errors.
  const mergedMessages: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const msg of chatMessages) {
    const last = mergedMessages[mergedMessages.length - 1];
    if (last && last.role === msg.role) {
      last.content += '\n\n' + msg.content;
    } else {
      mergedMessages.push({ ...msg });
    }
  }

  const body: Record<string, unknown> = {
    model: settings.activeModel,
    max_tokens: settings.maxTokens ?? 4096,
    temperature: settings.temperature ?? 0.8,
    stream: settings.streamingEnabled,
    messages: mergedMessages,
  };

  if (systemMsg?.content) body.system = systemMsg.content;

  return new Request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
}

function buildGoogleRequest(
  baseUrl: string | undefined,
  settings: AppSettings,
  apiKey: string,
  messages: ChatMessage[],
): Request {
  const base = (baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '');

  const systemMsg = messages.find(m => m.role === 'system');
  const nonSystemMsgs = messages.filter(m => m.role !== 'system');

  // FIX: Google requires alternating user/model turns. Merge consecutive same-role messages.
  const rawContents = nonSystemMsgs.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const contents: { role: string; parts: { text: string }[] }[] = [];
  for (const item of rawContents) {
    const last = contents[contents.length - 1];
    if (last && last.role === item.role) {
      // Merge into previous turn by appending text to the first part
      last.parts[0].text += '\n\n' + item.parts[0].text;
    } else {
      contents.push({ role: item.role, parts: [{ text: item.parts[0].text }] });
    }
  }

  // FIX: Google also requires the first content to be from 'user'
  if (contents.length > 0 && contents[0].role !== 'user') {
    contents.unshift({ role: 'user', parts: [{ text: '(Continue)' }] });
  }

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: settings.temperature ?? 0.8,
      maxOutputTokens: settings.maxTokens ?? 8192,
      topP: settings.topP ?? 0.9,
    },
  };

  if (systemMsg?.content) {
    body.systemInstruction = { parts: [{ text: systemMsg.content }] };
  }

  const encodedModel = encodeURIComponent(settings.activeModel);
  const endpoint = settings.streamingEnabled ? 'streamGenerateContent' : 'generateContent';
  const altSse = settings.streamingEnabled ? '&alt=sse' : '';

  return new Request(
    `${base}/models/${encodedModel}:${endpoint}?key=${encodeURIComponent(apiKey)}${altSse}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}

function buildMistralRequest(
  baseUrl: string | undefined,
  settings: AppSettings,
  apiKey: string,
  messages: ChatMessage[],
): Request {
  const base = (baseUrl || 'https://api.mistral.ai/v1').replace(/\/$/, '');

  const body: Record<string, unknown> = {
    model: settings.activeModel,
    messages,
    temperature: settings.temperature ?? 0.8,
    max_tokens: settings.maxTokens ?? 1024,
    top_p: settings.topP ?? 0.9,
    random_seed: Math.floor(Math.random() * 1_000_000),
    stream: settings.streamingEnabled,
  };

  return new Request(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
}

function buildNvidiaRequest(
  baseUrl: string | undefined,
  settings: AppSettings,
  apiKey: string,
  messages: ChatMessage[],
): Request {
  const url = baseUrl || 'https://roleplay.jameskaren.workers.dev/';

  const body: Record<string, unknown> = {
    model: settings.activeModel,
    messages,
    temperature: settings.temperature ?? 0.8,
    max_tokens: settings.maxTokens ?? 1024,
    top_p: settings.topP ?? 0.9,
    stream: settings.streamingEnabled,
    apiKey,
  };

  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function buildLocalRequest(
  baseUrl: string | undefined,
  settings: AppSettings,
  messages: ChatMessage[],
): Request {
  const base = (baseUrl || 'http://localhost:11434/v1').replace(/\/$/, '');
  const model = settings.activeModel || 'llama3.2';

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: settings.temperature ?? 0.8,
    max_tokens: settings.maxTokens ?? 2048,
    top_p: settings.topP ?? 0.9,
    stream: settings.streamingEnabled,
  };

  return new Request(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ---- Universal SSE Stream Parser ----
async function parseSSEStream(
  response: Response,
  provider: string,
  signal?: AbortSignal,
  callbacks?: StreamCallbacks,
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    callbacks?.onError('No response stream received');
    return;
  }

  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';
  let done = false;

  // Abort handler: cancel the reader when the signal fires
  const abortHandler = () => { reader.cancel().catch(() => {}); };
  signal?.addEventListener('abort', abortHandler);

  try {
    while (!done) {
      if (signal?.aborted) break;

      const result = await reader.read();
      done = result.done;
      if (result.done) break;

      buffer += decoder.decode(result.value, { stream: true });

      // Split on newlines; keep the last (potentially incomplete) chunk in the buffer
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (signal?.aborted) break;

        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue; // skip empty / SSE comments
        if (trimmed.startsWith('event:')) continue;        // skip named event lines
        if (!trimmed.startsWith('data:')) continue;

        // Safely strip the "data:" / "data: " prefix
        const dataStr = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed.slice(5);

        if (dataStr === '[DONE]') {
          callbacks?.onDone(fullText);
          return;
        }

        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(dataStr);
        } catch {
          // Malformed chunk — skip silently
          continue;
        }

        const token = extractTokenFromChunk(parsed, provider);
        if (token) {
          fullText += token;
          callbacks?.onToken(token);
        }

        const reasoning = extractReasoningFromChunk(parsed, provider);
        if (reasoning) {
          callbacks?.onThinking?.(reasoning);
        }
      }
    }

    // Process any data remaining in the buffer after the stream ends
    const remaining = buffer.trim();
    if (remaining && !signal?.aborted) {
      const dataStr = remaining.startsWith('data: ')
        ? remaining.slice(6)
        : remaining.startsWith('data:')
          ? remaining.slice(5)
          : null;

      if (dataStr && dataStr !== '[DONE]') {
        try {
          const parsed = JSON.parse(dataStr);
          const token = extractTokenFromChunk(parsed, provider);
          if (token) { fullText += token; callbacks?.onToken(token); }
          const reasoning = extractReasoningFromChunk(parsed, provider);
          if (reasoning) callbacks?.onThinking?.(reasoning);
        } catch { /* malformed — skip */ }
      }
    }

    callbacks?.onDone(fullText);
  } catch (error) {
    if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
      // Stream was intentionally cancelled — call onDone with whatever we have
      if (fullText) callbacks?.onDone(fullText);
      return;
    }
    const message = error instanceof Error ? error.message : 'Stream reading error';
    callbacks?.onError(message);
  } finally {
    signal?.removeEventListener('abort', abortHandler);
    // Always release the reader lock
    try { reader.releaseLock(); } catch { /* already released */ }
  }
}

/**
 * Extract reasoning/thinking content from a streaming chunk.
 *
 * Supports:
 * - OpenAI-compatible `reasoning_content` in delta (NVIDIA NIM, DeepSeek, some OpenRouter)
 * - Anthropic `thinking_delta` blocks
 */
function extractReasoningFromChunk(chunk: Record<string, unknown>, _provider: string): string {
  // OpenAI-compatible reasoning delta
  if (Array.isArray(chunk.choices) && chunk.choices.length > 0) {
    const delta = (chunk.choices[0] as Record<string, unknown>)?.delta as
      | Record<string, unknown>
      | undefined;
    if (delta && typeof delta.reasoning_content === 'string' && delta.reasoning_content) {
      return delta.reasoning_content;
    }
  }

  // Anthropic thinking_delta
  if (
    chunk.type === 'content_block_delta' &&
    typeof chunk.delta === 'object' &&
    chunk.delta !== null
  ) {
    const delta = chunk.delta as Record<string, unknown>;
    if (delta.type === 'thinking_delta' && typeof delta.thinking === 'string') {
      return delta.thinking;
    }
  }

  return '';
}

// ---- Extract a text token from a single SSE chunk ----
function extractTokenFromChunk(chunk: Record<string, unknown>, _provider: string): string {
  // OpenAI-compatible (Groq, OpenAI, Mistral, OpenRouter, NVIDIA, Custom, Local)
  if (Array.isArray(chunk.choices) && chunk.choices.length > 0) {
    const delta = (chunk.choices[0] as Record<string, unknown>)?.delta as
      | Record<string, unknown>
      | undefined;
    if (delta && typeof delta.content === 'string') return delta.content;
    // content can be null at the end of a stream — return '' rather than 'null'
    return '';
  }

  // Anthropic Messages API — text_delta
  if (chunk.type === 'content_block_delta') {
    const delta = chunk.delta as Record<string, unknown> | undefined;
    if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
      return delta.text;
    }
    return '';
  }

  // Google Gemini SSE
  if (Array.isArray(chunk.candidates) && chunk.candidates.length > 0) {
    const content = (chunk.candidates[0] as Record<string, unknown>)?.content as
      | Record<string, unknown>
      | undefined;
    if (content && Array.isArray(content.parts) && content.parts.length > 0) {
      const text = (content.parts[0] as { text?: string }).text;
      return typeof text === 'string' ? text : '';
    }
    return '';
  }

  return '';
}

// ---- Extract full text from a non-streaming JSON response ----
function extractTextFromResponse(data: Record<string, unknown>, _provider: string): string {
  // OpenAI-compatible
  if (Array.isArray(data.choices) && data.choices.length > 0) {
    const message = (data.choices[0] as Record<string, unknown>)?.message as
      | Record<string, unknown>
      | undefined;
    if (message && typeof message.content === 'string') return message.content;
    return '';
  }

  // Anthropic
  if (Array.isArray(data.content)) {
    return (data.content as Array<{ type: string; text?: string }>)
      .filter(c => c.type === 'text')
      .map(c => c.text ?? '')
      .join('');
  }

  // Google
  if (Array.isArray(data.candidates) && data.candidates.length > 0) {
    const content = (data.candidates[0] as Record<string, unknown>)?.content as
      | Record<string, unknown>
      | undefined;
    if (content && Array.isArray(content.parts)) {
      return (content.parts as Array<{ text?: string }>)
        .map(p => p.text ?? '')
        .join('');
    }
  }

  return '';
}

// ---- Token estimation ----

/**
 * Fast token estimator. Handles CJK, whitespace, and ASCII text.
 * (Original logic preserved; fixed missing word-boundary accounting.)
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  let tokens = 0;
  // FIX: The original counted whitespace chars as 0 but never counted the word they terminated.
  // A simpler and more accurate approach: count CJK at 1.5, split ASCII on whitespace.
  const cjkRegex = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g;
  const cjkMatches = text.match(cjkRegex);
  const cjkCount = cjkMatches ? cjkMatches.length : 0;

  // Strip CJK from text for word counting
  const withoutCJK = text.replace(cjkRegex, ' ');
  const wordCount = withoutCJK.trim() ? withoutCJK.trim().split(/\s+/).length : 0;

  // Rough GPT-style approximation: ~0.75 tokens per English word, 1.5 per CJK char
  tokens = Math.ceil(wordCount * 0.75 + cjkCount * 1.5);
  return tokens;
}

/**
 * Enhanced token estimator — handles CJK, emoji/Unicode symbols, and Latin text.
 * Kept aligned with the original's intent but with corrected math.
 */
export function estimateTokensEnhanced(text: string): number {
  if (!text) return 0;

  const cjkRegex = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g;
  const cjkMatches = text.match(cjkRegex);
  const cjkCount = cjkMatches ? cjkMatches.length : 0;

  // Emoji and non-ASCII, non-CJK, non-space characters
  const unicodeRegex = /[^\s\w\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g;
  const unicodeCount = (text.match(unicodeRegex) ?? []).length;

  // ASCII word count (strip CJK and unicode symbols first)
  const stripped = text.replace(cjkRegex, '').replace(unicodeRegex, '');
  const wordCount = stripped.trim() ? stripped.trim().split(/\s+/).length : 0;

  return Math.ceil(wordCount * 0.75 + cjkCount * 1.5 + unicodeCount * 1.2);
}

export function estimateMessageTokens(messages: ChatMessage[]): number {
  // FIX: Guard against empty/null messages array
  if (!messages?.length) return 0;
  return messages.reduce((sum, m) => sum + estimateTokens(m.content ?? '') + 4, 0);
}

// ============================================================
// Character Generation
// ============================================================

const CHARACTER_GENERATION_PROMPT = `Generate a roleplay character. Output ONLY valid JSON, nothing else. No markdown, no explanation.

JSON format:
{
  "name": "Unique Character Name",
  "description": "Physical appearance and background. 2 sentences.",
  "personality": "Traits and behavior. 2 sentences.",
  "knowledge": "What the character knows: skills, history, secrets. 2-3 sentences.",
  "scenario": "Setting and situation. 1-2 sentences.",
  "firstMessage": "Immersive greeting with actions in asterisks. Meet user first time.",
  "speechPatterns": "How they talk. 1-2 sentences.",
  "likes": "What they enjoy. 1-2 sentences.",
  "dislikes": "What they dislike. 1-2 sentences.",
  "behavior": "Roleplay guidelines. 1-2 sentences.",
  "tags": ["tag1", "tag2", "tag3", "tag4"]
}

Rules:
- Name memorable and unique
- Description gives clear visual image
- First message immersive, 2-4 sentences, uses *actions*
- Tags lowercase, 4-5 tags
- Creative but realistic
- JSON only, no text outside`;

export interface GeneratedCharacter {
  name: string;
  description: string;
  personality: string;
  knowledge: string;
  scenario: string;
  firstMessage: string;
  speechPatterns: string;
  likes: string;
  dislikes: string;
  behavior: string;
  tags: string[];
}

export interface GenerateCharacterOptions {
  userPrompt?: string;
  characterType?: string;
}

export async function generateCharacter(
  settings: AppSettings,
  options: GenerateCharacterOptions = {},
): Promise<GeneratedCharacter | null> {
  const providerConfig = settings.providers?.find(
    p => p.provider === settings.activeProvider && p.enabled,
  );

  if (!providerConfig) {
    throw new Error(
      `No API key configured for ${settings.activeProvider}. Please add an API key in Settings.`,
    );
  }

  const { userPrompt, characterType } = options;

  let systemPrompt = CHARACTER_GENERATION_PROMPT;
  if (characterType?.trim()) {
    systemPrompt += `\n\nCharacter type/style to focus on: ${characterType.trim()}`;
  }
  if (userPrompt?.trim()) {
    systemPrompt += `\n\nUser's request: "${userPrompt.trim()}"`;
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt?.trim() || 'Generate a unique and interesting character.' },
  ];

  let fullText = '';
  let streamError: string | null = null;

  await streamChatResponse(settings, messages, undefined, {
    onToken: token => { fullText += token; },
    onDone: () => {},
    onError: error => { streamError = error; },
  });

  // FIX: The original threw inside onError which bubbled as an unhandled rejection.
  // Now we check after the await and throw cleanly.
  if (streamError) {
    throw new Error(`Character generation failed: ${streamError}`);
  }

  if (!fullText.trim()) {
    throw new Error('Character generation returned an empty response. Please try again.');
  }

  // Parse the JSON response
  let jsonStr = fullText.trim();

  // Strip markdown code fences if the model wrapped its output
  jsonStr = jsonStr
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  // Extract the first JSON object from the response
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse character data: No valid JSON object found in response.');
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    throw new Error(
      `Failed to parse generated character JSON: ${e instanceof Error ? e.message : 'Unknown error'}. Please try again.`,
    );
  }

  // Validate and normalize — ensure all fields are present with safe defaults
  const character: GeneratedCharacter = {
    name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : 'Unnamed Character',
    description: typeof parsed.description === 'string' ? parsed.description : '',
    personality: typeof parsed.personality === 'string' ? parsed.personality : '',
    knowledge: typeof parsed.knowledge === 'string' ? parsed.knowledge : '',
    scenario: typeof parsed.scenario === 'string' ? parsed.scenario : '',
    firstMessage: typeof parsed.firstMessage === 'string' ? parsed.firstMessage : '',
    speechPatterns: typeof parsed.speechPatterns === 'string' ? parsed.speechPatterns : '',
    likes: typeof parsed.likes === 'string' ? parsed.likes : '',
    dislikes: typeof parsed.dislikes === 'string' ? parsed.dislikes : '',
    behavior: typeof parsed.behavior === 'string' ? parsed.behavior : '',
    // FIX: Filter out non-string tags and cap at 8
    tags: Array.isArray(parsed.tags)
      ? (parsed.tags as unknown[]).filter((t): t is string => typeof t === 'string').slice(0, 8)
      : [],
  };

  return character;
}