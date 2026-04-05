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
  // NVIDIA NIM - Tier 1: God Tier (70B+)
  // ==========================================
  { id: 'mistralai/mistral-large-3-675b-instruct-2512', name: 'Mistral Large 3 675B', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.002, costPer1kOutput: 0.002 },
  { id: 'qwen/qwen3.5-397b-a17b', name: 'Qwen3.5 397B', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.002, costPer1kOutput: 0.002 },
  { id: 'nvidia/llama-3.1-nemotron-ultra-253b-v1', name: 'Nemotron Ultra 253B', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.002, costPer1kOutput: 0.002 },
  { id: 'meta/llama-3.1-405b-instruct', name: 'Llama 3.1 405B', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.002, costPer1kOutput: 0.002 },
  { id: 'deepseek-ai/deepseek-v3.2', name: 'DeepSeek V3.2', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0015, costPer1kOutput: 0.002 },
  { id: 'deepseek-ai/deepseek-v3.1', name: 'DeepSeek V3.1', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0015, costPer1kOutput: 0.002 },
  { id: 'meta/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0007, costPer1kOutput: 0.0007 },
  { id: 'meta/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0007, costPer1kOutput: 0.0007 },
  { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.001, costPer1kOutput: 0.001 },
  { id: 'moonshotai/kimi-k2.5', name: 'Kimi K2.5', provider: 'nvidia', maxContextTokens: 200000, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.001, costPer1kOutput: 0.001 },
  { id: 'stockmark/stockmark-2-100b-instruct', name: 'Stockmark 2 100B', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0008, costPer1kOutput: 0.0008 },
  { id: 'institute-of-science-tokyo/llama-3.1-swallow-70b-instruct-v0.1', name: 'Llama Swallow 70B (JP)', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0007, costPer1kOutput: 0.0007 },
  { id: 'tokyotech-llm/llama-3-swallow-70b-instruct-v0.1', name: 'Llama Swallow 70B (TT)', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0007, costPer1kOutput: 0.0007 },
  { id: 'yentinglin/llama-3-taiwan-70b-instruct', name: 'Llama Taiwan 70B', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0007, costPer1kOutput: 0.0007 },

  // ==========================================
  // NVIDIA NIM - Tier 2: High-End MoE (40B-90B)
  // ==========================================
  { id: 'qwen/qwen3-coder-480b-a35b-instruct', name: 'Qwen3 Coder 480B', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.002, costPer1kOutput: 0.002 },
  { id: 'meta/llama-4-maverick-17b-128e-instruct', name: 'Llama 4 Maverick', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 32768, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00015, costPer1kOutput: 0.0006 },
  { id: 'nvidia/llama-3.3-nemotron-super-49b-v1.5', name: 'Nemotron Super 49B v1.5', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.001, costPer1kOutput: 0.001 },
  { id: 'nvidia/llama-3.3-nemotron-super-49b-v1', name: 'Nemotron Super 49B', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.001, costPer1kOutput: 0.001 },
  { id: 'mistralai/mistral-medium-3-instruct', name: 'Mistral Medium 3', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 16384, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.001, costPer1kOutput: 0.001 },
  { id: 'mistralai/mistral-small-4-119b-2603', name: 'Mistral Small 4 119B', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0008, costPer1kOutput: 0.0008 },
  { id: 'mistralai/mixtral-8x22b-instruct-v0.1', name: 'Mixtral 8x22B', provider: 'nvidia', maxContextTokens: 65536, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0005, costPer1kOutput: 0.0005 },
  { id: 'google/gemma-4-31b-it', name: 'Gemma 4 31B', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0002, costPer1kOutput: 0.0002 },
  { id: 'google/gemma-3-27b-it', name: 'Gemma 3 27B', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00015, costPer1kOutput: 0.00015 },
  { id: 'mistralai/devstral-2-123b-instruct-2512', name: 'Devstral 2 123B', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.001, costPer1kOutput: 0.001 },
  { id: 'qwen/qwen3.5-122b-a10b', name: 'Qwen3.5 122B', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0008, costPer1kOutput: 0.0008 },
  { id: 'moonshotai/kimi-k2-instruct-0905', name: 'Kimi K2 Instruct 0905', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0008, costPer1kOutput: 0.0008 },
  { id: 'moonshotai/kimi-k2-instruct', name: 'Kimi K2 Instruct', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0008, costPer1kOutput: 0.0008 },
  { id: 'mistralai/mistral-small-3.1-24b-instruct-2503', name: 'Mistral Small 3.1 24B', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00015, costPer1kOutput: 0.00015 },
  { id: 'mistralai/mistral-small-24b-instruct', name: 'Mistral Small 24B', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00015, costPer1kOutput: 0.00015 },

  // ==========================================
  // NVIDIA NIM - Tier 3: Workhorses (8B-15B)
  // ==========================================
  { id: 'mistralai/mixtral-8x7b-instruct-v0.1', name: 'Mixtral 8x7B', provider: 'nvidia', maxContextTokens: 32768, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00024, costPer1kOutput: 0.00024 },
  { id: 'mistralai/magistral-small-2506', name: 'Magistral Small', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0001, costPer1kOutput: 0.0001 },
  { id: 'microsoft/phi-4-multimodal-instruct', name: 'Phi-4 Multimodal', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.0001, costPer1kOutput: 0.0001 },
  { id: 'google/gemma-3-12b-it', name: 'Gemma 3 12B', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00008, costPer1kOutput: 0.00008 },
  { id: 'google/gemma-2-27b-it', name: 'Gemma 2 27B', provider: 'nvidia', maxContextTokens: 8192, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00015, costPer1kOutput: 0.00015 },
  { id: 'meta/llama-3.1-8b-instruct', name: 'Llama 3.1 8B', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00015, costPer1kOutput: 0.00015 },
  { id: 'meta/llama3-8b-instruct', name: 'Llama 3 8B', provider: 'nvidia', maxContextTokens: 8192, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00012, costPer1kOutput: 0.00012 },
  { id: 'meta/llama-3.2-3b-instruct', name: 'Llama 3.2 3B', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00008, costPer1kOutput: 0.00008 },
  { id: 'meta/llama-3.2-1b-instruct', name: 'Llama 3.2 1B', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00005, costPer1kOutput: 0.00005 },
  { id: 'qwen/qwen2.5-coder-32b-instruct', name: 'Qwen Coder 32B', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0002, costPer1kOutput: 0.0002 },
  { id: 'qwen/qwen3-next-80b-a3b-instruct', name: 'Qwen3 Next 80B', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0005, costPer1kOutput: 0.0005 },
  { id: 'qwen/qwen3-next-80b-a3b-thinking', name: 'Qwen3 Next 80B Thinking', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 16384, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0005, costPer1kOutput: 0.0005 },
  { id: 'moonshotai/kimi-k2-thinking', name: 'Kimi K2 Thinking', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 16384, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0008, costPer1kOutput: 0.0008 },
  { id: 'google/gemma-2-9b-it', name: 'Gemma 2 9B', provider: 'nvidia', maxContextTokens: 8192, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00008, costPer1kOutput: 0.00008 },
  { id: 'google/gemma-3-4b-it', name: 'Gemma 3 4B', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00005, costPer1kOutput: 0.00005 },
  { id: 'upstage/solar-10.7b-instruct', name: 'Solar 10.7B', provider: 'nvidia', maxContextTokens: 32768, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00015, costPer1kOutput: 0.00015 },
  { id: 'nvidia/nvidia-nemotron-nano-9b-v2', name: 'Nemotron Nano 9B v2', provider: 'nvidia', maxContextTokens: 32768, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0001, costPer1kOutput: 0.0001 },
  { id: 'nvidia/llama-3.1-nemotron-nano-8b-v1', name: 'Nemotron Nano 8B', provider: 'nvidia', maxContextTokens: 32768, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00008, costPer1kOutput: 0.00008 },
  { id: 'microsoft/phi-3-medium-128k-instruct', name: 'Phi-3 Medium 128K', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0001, costPer1kOutput: 0.0001 },
  { id: 'microsoft/phi-3-medium-4k-instruct', name: 'Phi-3 Medium 4K', provider: 'nvidia', maxContextTokens: 4096, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0001, costPer1kOutput: 0.0001 },
  { id: 'microsoft/phi-3-small-128k-instruct', name: 'Phi-3 Small 128K', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00005, costPer1kOutput: 0.00005 },
  { id: 'microsoft/phi-3-small-8k-instruct', name: 'Phi-3 Small 8K', provider: 'nvidia', maxContextTokens: 8192, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00005, costPer1kOutput: 0.00005 },
  { id: 'microsoft/phi-3.5-mini-instruct', name: 'Phi-3.5 Mini', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00005, costPer1kOutput: 0.00005 },
  { id: 'microsoft/phi-4-mini-flash-reasoning', name: 'Phi-4 Mini Flash Reasoning', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 16384, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00005, costPer1kOutput: 0.00005 },
  { id: 'qwen/qwen2.5-7b-instruct', name: 'Qwen 2.5 7B', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00005, costPer1kOutput: 0.00005 },
  { id: 'qwen/qwen2-7b-instruct', name: 'Qwen 2 7B', provider: 'nvidia', maxContextTokens: 32768, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00005, costPer1kOutput: 0.00005 },
  { id: 'qwen/qwen2.5-coder-7b-instruct', name: 'Qwen Coder 7B', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00005, costPer1kOutput: 0.00005 },
  { id: 'deepseek-ai/deepseek-r1-distill-llama-8b', name: 'DeepSeek R1 Llama 8B', provider: 'nvidia', maxContextTokens: 32768, maxOutputTokens: 16384, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0001, costPer1kOutput: 0.0001 },
  { id: 'minimaxai/minimax-m2.5', name: 'MiniMax M2.5', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00005, costPer1kOutput: 0.00005 },
  { id: 'nvidia/nemotron-3-super-120b-a12b', name: 'Nemotron 3 Super 120B', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0008, costPer1kOutput: 0.0008 },
  { id: 'nvidia/nemotron-3-nano-30b-a3b', name: 'Nemotron 3 Nano 30B', provider: 'nvidia', maxContextTokens: 65536, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0002, costPer1kOutput: 0.0002 },
  { id: 'nvidia/nemotron-nano-12b-v2-vl', name: 'Nemotron Nano 12B VL', provider: 'nvidia', maxContextTokens: 32768, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.00015, costPer1kOutput: 0.00015 },

  // ==========================================
  // NVIDIA NIM - Tier 4: Niche/Vision/Older
  // ==========================================
  { id: 'abacusai/dracarys-llama-3.1-70b-instruct', name: 'Dracarys Llama 70B', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0007, costPer1kOutput: 0.0007 },
  { id: 'meta/llama-3.2-90b-vision-instruct', name: 'Llama 3.2 90B Vision', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.0008, costPer1kOutput: 0.0008 },
  { id: 'meta/llama-3.2-11b-vision-instruct', name: 'Llama 3.2 11B Vision', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.00015, costPer1kOutput: 0.00015 },
  { id: 'nvidia/llama-3.1-nemotron-nano-vl-8b-v1', name: 'Nemotron Nano VL 8B', provider: 'nvidia', maxContextTokens: 32768, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.00008, costPer1kOutput: 0.00008 },
  { id: 'microsoft/phi-3.5-vision-instruct', name: 'Phi-3.5 Vision', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.00005, costPer1kOutput: 0.00005 },
  { id: 'ai21labs/jamba-1.5-mini-instruct', name: 'Jamba 1.5 Mini', provider: 'nvidia', maxContextTokens: 32768, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0001, costPer1kOutput: 0.0001 },
  { id: 'baichuan-inc/baichuan2-13b-chat', name: 'Baichuan2 13B (CN)', provider: 'nvidia', maxContextTokens: 32768, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0002, costPer1kOutput: 0.0002 },
  { id: 'bytedance/seed-oss-36b-instruct', name: 'Seed OSS 36B', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0003, costPer1kOutput: 0.0003 },
  { id: 'thudm/chatglm3-6b', name: 'ChatGLM3 6B (CN)', provider: 'nvidia', maxContextTokens: 32768, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0001, costPer1kOutput: 0.0001 },
  { id: 'z-ai/glm4.7', name: 'GLM4.7 (CN)', provider: 'nvidia', maxContextTokens: 32768, maxOutputTokens: 16384, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.001, costPer1kOutput: 0.001 },
  { id: 'sarvamai/sarvam-m', name: 'Sarvam-M (Indian)', provider: 'nvidia', maxContextTokens: 32768, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00015, costPer1kOutput: 0.00015 },
  { id: 'nvidia/nemotron-4-mini-hindi-4b-instruct', name: 'Nemotron Hindi 4B', provider: 'nvidia', maxContextTokens: 8192, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00005, costPer1kOutput: 0.00005 },
  { id: 'rakuten/rakutenai-7b-chat', name: 'RakutenAI 7B Chat (JP)', provider: 'nvidia', maxContextTokens: 32768, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0001, costPer1kOutput: 0.0001 },
  { id: 'rakuten/rakutenai-7b-instruct', name: 'RakutenAI 7B Instruct (JP)', provider: 'nvidia', maxContextTokens: 32768, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0001, costPer1kOutput: 0.0001 },
  { id: 'speakleash/bielik-11b-v2.6-instruct', name: 'Bielik 11B v2.6 (PL)', provider: 'nvidia', maxContextTokens: 32768, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00015, costPer1kOutput: 0.00015 },
  { id: 'speakleash/bielik-11b-v2.3-instruct', name: 'Bielik 11B v2.3 (PL)', provider: 'nvidia', maxContextTokens: 32768, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00015, costPer1kOutput: 0.00015 },
  { id: 'igenius/italia_10b_instruct_16k', name: 'Italia 10B (IT)', provider: 'nvidia', maxContextTokens: 16384, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00015, costPer1kOutput: 0.00015 },
  { id: 'utter-project/eurollm-9b-instruct', name: 'EuroLLM 9B (EU)', provider: 'nvidia', maxContextTokens: 32768, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0001, costPer1kOutput: 0.0001 },
  { id: 'gotocompany/gemma-2-9b-cpt-sahabatai-instruct', name: 'Gemma 2 9B CPT (ID)', provider: 'nvidia', maxContextTokens: 32768, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00008, costPer1kOutput: 0.00008 },
  { id: 'opengpt-x/teuken-7b-instruct-commercial-v0.4', name: 'Teuken 7B v0.4 (EU)', provider: 'nvidia', maxContextTokens: 32768, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0001, costPer1kOutput: 0.0001 },
  { id: 'marin/marin-8b-instruct', name: 'Marin 8B', provider: 'nvidia', maxContextTokens: 32768, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0001, costPer1kOutput: 0.0001 },
  { id: 'mediatek/breeze-7b-instruct', name: 'Breeze 7B', provider: 'nvidia', maxContextTokens: 32768, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0001, costPer1kOutput: 0.0001 },
  { id: 'stepfun-ai/step-3.5-flash', name: 'Step 3.5 Flash', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00005, costPer1kOutput: 0.00005 },
  { id: 'tiiuae/falcon3-7b-instruct', name: 'Falcon 3 7B', provider: 'nvidia', maxContextTokens: 32768, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00008, costPer1kOutput: 0.00008 },
  { id: 'google/gemma-7b', name: 'Gemma 7B', provider: 'nvidia', maxContextTokens: 8192, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0002, costPer1kOutput: 0.0002 },
  { id: 'google/gemma-3-1b-it', name: 'Gemma 3 1B', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00005, costPer1kOutput: 0.00005 },
  { id: 'google/gemma-3n-e4b-it', name: 'Gemma 3N E4B', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00005, costPer1kOutput: 0.00005 },
  { id: 'google/gemma-3n-e2b-it', name: 'Gemma 3N E2B', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00005, costPer1kOutput: 0.00005 },
  { id: 'institute-of-science-tokyo/llama-3.1-swallow-8b-instruct-v0.1', name: 'Llama Swallow 8B (JP)', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00015, costPer1kOutput: 0.00015 },
  { id: 'microsoft/phi-3-mini-128k-instruct', name: 'Phi-3 Mini 128K', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00005, costPer1kOutput: 0.00005 },
  { id: 'microsoft/phi-3-mini-4k-instruct', name: 'Phi-3 Mini 4K', provider: 'nvidia', maxContextTokens: 4096, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00005, costPer1kOutput: 0.00005 },
  { id: 'nvidia/llama3-chatqa-1.5-8b', name: 'Llama3 ChatQA 8B', provider: 'nvidia', maxContextTokens: 16384, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0001, costPer1kOutput: 0.0001 },

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

// ============================================================
// Build System Prompt
// ============================================================
// Design goals:
//   1. Token-efficient — only emit sections that have content
//   2. Immersive roleplay framing that works across all models
//   3. Concrete formatting rules stated once, not repeated
//   4. Memory + summary injected at the end (closest to the new turn = highest attention)
// ============================================================
export function buildSystemPrompt(
  character: Character,
  settings: AppSettings,
  memories: string[],
  summary: string,
): string {
  const sections: string[] = [];

  // ── Optional operator-level overrides ───────────────────────
  if (settings.jailbreakPrompt?.trim()) {
    sections.push(settings.jailbreakPrompt.trim());
  }
  if (settings.customSystemPrompt?.trim()) {
    sections.push(settings.customSystemPrompt.trim());
  }

  // ── User persona (only emit lines that exist) ────────────────
  const persona = settings.userPersona;
  const hasPersonaName = persona?.name?.trim() && persona.name.trim() !== 'You';
  const userLines: string[] = ['[User]'];
  if (hasPersonaName) userLines.push(`Name: ${persona.name.trim()}`);
  if (persona?.description?.trim()) userLines.push(`Description: ${persona.description.trim()}`);
  if (persona?.personality?.trim()) userLines.push(`Personality: ${persona.personality.trim()}`);
  if (persona?.speechPatterns?.trim()) userLines.push(`Speech style: ${persona.speechPatterns.trim()}`);
  // Only include the user block if there's at least one field beyond the header
  if (userLines.length > 1) sections.push(userLines.join('\n'));

  // ── Character card ───────────────────────────────────────────
  const charLines: string[] = [`[Character: ${character.name}]`];
  if (character.description?.trim()) charLines.push(`Appearance/background: ${character.description.trim()}`);
  if (character.personality?.trim()) charLines.push(`Personality: ${character.personality.trim()}`);
  if (character.speechPatterns?.trim()) charLines.push(`Speech patterns: ${character.speechPatterns.trim()}`);
  if (character.knowledge?.trim()) charLines.push(`Knowledge/skills: ${character.knowledge.trim()}`);
  if (character.relationship?.trim()) charLines.push(`Relationship to user: ${character.relationship.trim()}`);
  if (character.likes?.trim()) charLines.push(`Likes: ${character.likes.trim()}`);
  if (character.dislikes?.trim()) charLines.push(`Dislikes: ${character.dislikes.trim()}`);
  if (character.behavior?.trim()) charLines.push(`Behavioral notes: ${character.behavior.trim()}`);
  if (character.scenario?.trim()) charLines.push(`\nScenario: ${character.scenario.trim()}`);
  sections.push(charLines.join('\n'));

  // ── Example dialogue ─────────────────────────────────────────
  if (character.exampleMessages?.trim()) {
    sections.push(`[Example dialogue]\n${character.exampleMessages.trim()}`);
  }

  // ── Core roleplay instructions ────────────────────────────────
  // Kept tight: no redundancy, no restating the same rule two ways.
  // Positive framing ("do X") preferred over negative ("don't do Y") where possible.
  sections.push(`[Roleplay rules]
You ARE ${character.name}. Embody them completely — their voice, mannerisms, desires, flaws.
• Stay in character at all times. Never reference being an AI or break the fourth wall.
• Remember the user's persona details above and address them naturally in character.
• Advance the story: introduce new beats, reveal emotion through action, avoid restating what was just said.
• Write 1–3 paragraphs per response. Be vivid and purposeful, never padded.
• No meta-commentary, reasoning traces, or out-of-character notes.

[Formatting]
• *italics* for physical actions and internal feelings
• "double quotes" for spoken dialogue
• **bold** for emphasis or dramatic beats
• Never use single quotes for speech`);

  // ── Conversation summary (context anchor) ────────────────────
  if (summary?.trim()) {
    sections.push(`[Story so far]\n${summary.trim()}`);
  }

  // ── Memories (injected last for highest model attention) ──────
  const validMemories = (memories ?? []).map(m => m?.trim()).filter(Boolean);
  if (validMemories.length > 0) {
    sections.push(`[Key memories]\n${validMemories.join('\n')}`);
  }

  return sections.join('\n\n');
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
  if (signal?.aborted) return '';

  if (!messages?.length) {
    callbacks?.onError('No messages provided to streamChatResponse.');
    return '';
  }

  const providerConfig = settings.providers?.find(
    p => p.provider === settings.activeProvider && p.enabled,
  );

  if (!providerConfig) {
    callbacks?.onError(
      `No active provider config found for "${settings.activeProvider}". Add your API key in Settings.`,
    );
    return '';
  }

  const requiresKey = settings.activeProvider !== 'local';
  if (requiresKey && !providerConfig.apiKey?.trim()) {
    callbacks?.onError(
      `API key for ${settings.activeProvider} is empty. Add your API key in Settings.`,
    );
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
      const errorText = await parseErrorResponse(response);
      const hint = buildErrorHint(provider, response.status);
      callbacks?.onError(`${provider} error (${response.status}): ${errorText}${hint}`);
      return '';
    }

    if (settings.streamingEnabled && callbacks) {
      await parseSSEStream(response, provider, signal, callbacks);
      return '';
    }

    const data = await response.json();
    const text = extractTextFromResponse(data, provider);
    callbacks?.onToken(text);
    callbacks?.onDone(text);
    return text;
  } catch (error) {
    if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) return '';
    callbacks?.onError(error instanceof Error ? error.message : 'Unknown network error.');
    return '';
  }
}

// ---- Error helpers ----

async function parseErrorResponse(response: Response): Promise<string> {
  try {
    const errData = await response.json();
    return (
      errData?.error?.message ||
      errData?.error?.code ||
      errData?.message ||
      JSON.stringify(errData)
    );
  } catch {
    try { return (await response.text()) || `HTTP ${response.status}`; }
    catch { return `HTTP ${response.status}`; }
  }
}

function buildErrorHint(provider: string, status: number): string {
  if (status === 401 || status === 403) return getAuthErrorHint(provider);
  if (status === 404) return '\n\nCheck the model ID in Settings.';
  if (status === 429) return '\n\nRate limited — wait a moment and retry.';
  if (status >= 500) return '\n\nServer error on the provider side. Try again shortly.';
  return '';
}

function getAuthErrorHint(provider: string): string {
  const hints: Record<string, string> = {
    groq: '\n\n💡 Key should start with "gsk_" — get one at https://console.groq.com/keys',
    anthropic: '\n\n💡 Get your key at https://console.anthropic.com/',
    google: '\n\n💡 Get your key at https://aistudio.google.com/apikey',
    openai: '\n\n💡 Get your key at https://platform.openai.com/api-keys',
    nvidia: '\n\n💡 Get your key at https://build.nvidia.com/',
    mistral: '\n\n💡 Get your key at https://console.mistral.ai/',
    local: '\n\n💡 Make sure your local server is running (Ollama, LM Studio, etc.)',
  };
  return hints[provider] ?? '\n\n💡 Check that your API key is valid.';
}

// ---- Request builders ----

function buildGroqRequest(settings: AppSettings, apiKey: string, messages: ChatMessage[]): Request {
  const body: Record<string, unknown> = {
    model: settings.activeModel,
    messages,
    temperature: settings.temperature ?? 0.8,
    max_tokens: settings.maxTokens ?? 1024,
    top_p: settings.topP ?? 0.9,
    stream: settings.streamingEnabled,
    // Groq does NOT support frequency_penalty / presence_penalty
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
  const fallback = provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1';
  const base = (baseUrl || fallback).replace(/\/$/, '');

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
  return new Request(`${base}/chat/completions`, { method: 'POST', headers, body: JSON.stringify(body) });
}

function buildAnthropicRequest(
  baseUrl: string | undefined,
  settings: AppSettings,
  apiKey: string,
  messages: ChatMessage[],
): Request {
  const url = (baseUrl || 'https://api.anthropic.com/v1/messages').replace(/\/$/, '');

  const systemMsg = messages.find(m => m.role === 'system');
  const nonSystem = messages.filter(m => m.role !== 'system');

  // Map to user/assistant; default unknown roles to 'user'
  const chatMessages = nonSystem.map(m => ({
    role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
    content: m.content,
  }));

  // Anthropic requires first message = user
  if (chatMessages.length > 0 && chatMessages[0].role === 'assistant') {
    chatMessages.unshift({ role: 'user', content: '(Continue)' });
  }

  // Merge consecutive same-role messages
  const merged: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const msg of chatMessages) {
    const last = merged[merged.length - 1];
    if (last?.role === msg.role) {
      last.content += '\n\n' + msg.content;
    } else {
      merged.push({ ...msg });
    }
  }

  const body: Record<string, unknown> = {
    model: settings.activeModel,
    max_tokens: settings.maxTokens ?? 4096,
    temperature: settings.temperature ?? 0.8,
    stream: settings.streamingEnabled,
    messages: merged,
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
  const nonSystem = messages.filter(m => m.role !== 'system');

  // Map and merge consecutive same-role turns (Google requires strict alternation)
  const rawContents = nonSystem.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const contents: { role: string; parts: { text: string }[] }[] = [];
  for (const item of rawContents) {
    const last = contents[contents.length - 1];
    if (last?.role === item.role) {
      last.parts[0].text += '\n\n' + item.parts[0].text;
    } else {
      contents.push({ role: item.role, parts: [{ text: item.parts[0].text }] });
    }
  }

  // Google requires first content to be 'user'
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
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
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
  const body: Record<string, unknown> = {
    model: settings.activeModel || 'llama3.2',
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
    callbacks?.onError('No response stream received.');
    return;
  }

  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';
  let done = false;

  const abortHandler = () => { reader.cancel().catch(() => { }); };
  signal?.addEventListener('abort', abortHandler);

  try {
    while (!done) {
      if (signal?.aborted) break;

      const result = await reader.read();
      done = result.done;
      if (result.done) break;

      buffer += decoder.decode(result.value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (signal?.aborted) break;

        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':') || trimmed.startsWith('event:')) continue;
        if (!trimmed.startsWith('data:')) continue;

        const dataStr = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed.slice(5);
        if (dataStr === '[DONE]') { callbacks?.onDone(fullText); return; }

        let parsed: Record<string, unknown>;
        try { parsed = JSON.parse(dataStr); }
        catch { continue; }

        const token = extractTokenFromChunk(parsed, provider);
        if (token) { fullText += token; callbacks?.onToken(token); }

        const reasoning = extractReasoningFromChunk(parsed);
        if (reasoning) callbacks?.onThinking?.(reasoning);
      }
    }

    // Flush remaining buffer
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
          const reasoning = extractReasoningFromChunk(parsed);
          if (reasoning) callbacks?.onThinking?.(reasoning);
        } catch { /* malformed — skip */ }
      }
    }

    callbacks?.onDone(fullText);
  } catch (error) {
    if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
      if (fullText) callbacks?.onDone(fullText);
      return;
    }
    callbacks?.onError(error instanceof Error ? error.message : 'Stream reading error.');
  } finally {
    signal?.removeEventListener('abort', abortHandler);
    try { reader.releaseLock(); } catch { /* already released */ }
  }
}

/**
 * Extract reasoning/thinking content from a streaming chunk.
 * Supports OpenAI-style reasoning_content and Anthropic thinking_delta.
 */
function extractReasoningFromChunk(chunk: Record<string, unknown>): string {
  // OpenAI-compatible reasoning delta (NVIDIA NIM, DeepSeek, some OpenRouter models)
  if (Array.isArray(chunk.choices) && chunk.choices.length > 0) {
    const delta = (chunk.choices[0] as Record<string, unknown>)?.delta as Record<string, unknown> | undefined;
    if (typeof delta?.reasoning_content === 'string' && delta.reasoning_content) {
      return delta.reasoning_content;
    }
  }

  // Anthropic thinking_delta
  if (chunk.type === 'content_block_delta' && chunk.delta !== null && typeof chunk.delta === 'object') {
    const delta = chunk.delta as Record<string, unknown>;
    if (delta.type === 'thinking_delta' && typeof delta.thinking === 'string') {
      return delta.thinking;
    }
  }

  return '';
}

/** Extract a text token from a single SSE chunk across all supported provider formats. */
function extractTokenFromChunk(chunk: Record<string, unknown>, _provider: string): string {
  // OpenAI-compatible (Groq, OpenAI, Mistral, OpenRouter, NVIDIA, custom, local)
  if (Array.isArray(chunk.choices) && chunk.choices.length > 0) {
    const delta = (chunk.choices[0] as Record<string, unknown>)?.delta as Record<string, unknown> | undefined;
    return typeof delta?.content === 'string' ? delta.content : '';
  }

  // Anthropic Messages API — text_delta
  if (chunk.type === 'content_block_delta') {
    const delta = chunk.delta as Record<string, unknown> | undefined;
    return delta?.type === 'text_delta' && typeof delta.text === 'string' ? delta.text : '';
  }

  // Google Gemini SSE
  if (Array.isArray(chunk.candidates) && chunk.candidates.length > 0) {
    const content = (chunk.candidates[0] as Record<string, unknown>)?.content as Record<string, unknown> | undefined;
    if (content && Array.isArray(content.parts) && content.parts.length > 0) {
      const text = (content.parts[0] as { text?: string }).text;
      return typeof text === 'string' ? text : '';
    }
    return '';
  }

  return '';
}

/** Extract full text from a non-streaming JSON response across all supported provider formats. */
function extractTextFromResponse(data: Record<string, unknown>, _provider: string): string {
  // OpenAI-compatible
  if (Array.isArray(data.choices) && data.choices.length > 0) {
    const message = (data.choices[0] as Record<string, unknown>)?.message as Record<string, unknown> | undefined;
    return typeof message?.content === 'string' ? message.content : '';
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
    const content = (data.candidates[0] as Record<string, unknown>)?.content as Record<string, unknown> | undefined;
    if (content && Array.isArray(content.parts)) {
      return (content.parts as Array<{ text?: string }>).map(p => p.text ?? '').join('');
    }
  }

  return '';
}

// ============================================================
// Token estimation
// ============================================================

/** Fast token estimator — handles CJK, emoji/Unicode, and Latin text. */
export function estimateTokens(text: string): number {
  if (!text) return 0;

  const cjkRegex = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g;
  const cjkCount = (text.match(cjkRegex) ?? []).length;

  const withoutCJK = text.replace(cjkRegex, ' ');
  const wordCount = withoutCJK.trim() ? withoutCJK.trim().split(/\s+/).length : 0;

  // ~0.75 tokens/English word, ~1.5 tokens/CJK character
  return Math.ceil(wordCount * 0.75 + cjkCount * 1.5);
}

/** Extended estimator that also weights emoji/non-ASCII symbols separately. */
export function estimateTokensEnhanced(text: string): number {
  if (!text) return 0;

  const cjkRegex = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g;
  const cjkCount = (text.match(cjkRegex) ?? []).length;

  const unicodeRegex = /[^\s\w\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g;
  const unicodeCount = (text.match(unicodeRegex) ?? []).length;

  const stripped = text.replace(cjkRegex, '').replace(unicodeRegex, '');
  const wordCount = stripped.trim() ? stripped.trim().split(/\s+/).length : 0;

  return Math.ceil(wordCount * 0.75 + cjkCount * 1.5 + unicodeCount * 1.2);
}

export function estimateMessageTokens(messages: ChatMessage[]): number {
  if (!messages?.length) return 0;
  // +4 per message accounts for role/turn overhead in most tokenizers
  return messages.reduce((sum, m) => sum + estimateTokens(m.content ?? '') + 4, 0);
}

// ============================================================
// Character Generation
// ============================================================

// Improved: more concise prompt (fewer output tokens consumed on the instruction side),
// richer first-message guidance, and clearer JSON schema description.
const CHARACTER_GENERATION_PROMPT = `You are a creative writer specializing in immersive roleplay characters. Output ONLY valid JSON — no markdown fences, no explanation.

Schema:
{
  "name": "Distinctive, memorable name",
  "description": "2 sentences: vivid physical appearance + brief background",
  "personality": "2 sentences: core traits, internal contradictions, what drives them",
  "knowledge": "2–3 sentences: skills, expertise, formative experiences",
  "scenario": "1–2 sentences: where they are, what's happening right now",
  "firstMessage": "3–5 sentences in character voice. Start mid-scene with *action*. Reveal personality through behavior, not exposition. End with something that invites the user to respond.",
  "speechPatterns": "1–2 sentences: cadence, vocabulary, verbal tics, accent cues",
  "likes": "1–2 sentences: specific, unexpected passions",
  "dislikes": "1–2 sentences: genuine aversions that cause friction",
  "behavior": "1–2 sentences: how they behave under pressure, what boundaries they have",
  "tags": ["tag1","tag2","tag3","tag4","tag5"]
}

Rules:
- Characters must have a flaw or contradiction — perfection is boring
- First message must feel like the story has already started
- Tags: lowercase, genre/archetype/mood, 4–6 total
- JSON only`;

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
    throw new Error(`No API key configured for ${settings.activeProvider}. Add one in Settings.`);
  }

  const { userPrompt, characterType } = options;

  let systemPrompt = CHARACTER_GENERATION_PROMPT;
  if (characterType?.trim()) systemPrompt += `\n\nFocus: ${characterType.trim()}`;
  if (userPrompt?.trim()) systemPrompt += `\n\nUser request: "${userPrompt.trim()}"`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt?.trim() || 'Generate a unique, compelling character.' },
  ];

  let fullText = '';
  let streamError: string | null = null;

  await streamChatResponse(settings, messages, undefined, {
    onToken: token => { fullText += token; },
    onDone: () => { },
    onError: error => { streamError = error; },
  });

  if (streamError) throw new Error(`Character generation failed: ${streamError}`);
  if (!fullText.trim()) throw new Error('Character generation returned an empty response. Please try again.');

  // Strip markdown fences if the model added them
  let jsonStr = fullText.trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse character data: no valid JSON object in response.');
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    throw new Error(
      `Failed to parse character JSON: ${e instanceof Error ? e.message : 'Unknown error'}. Try again.`,
    );
  }

  const str = (key: string): string =>
    typeof parsed[key] === 'string' ? (parsed[key] as string) : '';

  return {
    name: str('name').trim() || 'Unnamed Character',
    description: str('description'),
    personality: str('personality'),
    knowledge: str('knowledge'),
    scenario: str('scenario'),
    firstMessage: str('firstMessage'),
    speechPatterns: str('speechPatterns'),
    likes: str('likes'),
    dislikes: str('dislikes'),
    behavior: str('behavior'),
    tags: Array.isArray(parsed.tags)
      ? (parsed.tags as unknown[]).filter((t): t is string => typeof t === 'string').slice(0, 8)
      : [],
  };
}

// ============================================================
// Image Prompt Enhancement
// ============================================================

export async function enhanceImagePrompt(
  settings: AppSettings,
  userPrompt: string,
  context?: string,
): Promise<string> {
  // Tight prompt — we only need 1–3 sentences back, so keep instructions minimal
  const contextClause = context ? ` Scene context: ${context}.` : '';
  const prompt =
    `Rewrite the following image prompt to be more detailed and visually specific for an AI image generator.${contextClause} Add lighting, mood, composition, and quality keywords. Keep it to 1–3 sentences. Output the enhanced prompt only, no explanation.\n\nOriginal: "${userPrompt}"`;

  return new Promise(resolve => {
    let result = '';
    streamChatResponse(
      settings,
      [{ role: 'user', content: prompt }],
      undefined,
      {
        onToken: token => { result += token; },
        onDone: () => { resolve(result.trim() || userPrompt); },
        onError: () => { resolve(userPrompt); },
      },
    );
  });
}

export async function enhanceTextPrompt(
  settings: AppSettings,
  text: string,
): Promise<string> {
  const prompt = `Enhance this text prompt for AI image generation. Make it more detailed and descriptive while keeping the original meaning. Output only the enhanced prompt, nothing else.\n\nOriginal: "${text}"`;

  return new Promise(resolve => {
    let result = '';
    streamChatResponse(
      settings,
      [{ role: 'user', content: prompt }],
      undefined,
      {
        onToken: token => { result += token; },
        onDone: () => { resolve(result.trim() || text); },
        onError: () => { resolve(text); },
      },
    );
  });
}

export async function enhanceCustomAvatarPrompt(
  settings: AppSettings,
  text: string,
): Promise<string> {
  const prompt = `Make this avatar generation prompt more detailed and visually specific. Add lighting, style, composition, and quality keywords. Keep the original meaning. Output only the enhanced prompt.\n\nOriginal: "${text}"`;

  return new Promise(resolve => {
    let result = '';
    streamChatResponse(
      settings,
      [{ role: 'user', content: prompt }],
      undefined,
      {
        onToken: token => { result += token; },
        onDone: () => { resolve(result.trim() || text); },
        onError: () => { resolve(text); },
      },
    );
  });
}