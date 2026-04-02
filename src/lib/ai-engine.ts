// ============================================================
// AI Engine - Multi-provider BYOK streaming
// Converts responses from various providers to unified format
// ============================================================

import type { AIProvider, AIModel, AppSettings, Character } from './types';

// ---- Model Registry ----
export const AI_MODELS: AIModel[] = [
  // ==========================================
  // OpenAI
  // ==========================================
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', maxContextTokens: 128000, maxOutputTokens: 16384, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.005, costPer1kOutput: 0.015 },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', maxContextTokens: 128000, maxOutputTokens: 16384, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.00015, costPer1kOutput: 0.0006 },
  { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'openai', maxContextTokens: 1047576, maxOutputTokens: 32768, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.002, costPer1kOutput: 0.008 },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', provider: 'openai', maxContextTokens: 1047576, maxOutputTokens: 32768, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.0004, costPer1kOutput: 0.0016 },
  { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', provider: 'openai', maxContextTokens: 1047576, maxOutputTokens: 32768, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.0001, costPer1kOutput: 0.0004 },
  { id: 'o3-mini', name: 'o3-mini', provider: 'openai', maxContextTokens: 200000, maxOutputTokens: 100000, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0011, costPer1kOutput: 0.0044 },
  { id: 'o4-mini', name: 'o4-mini', provider: 'openai', maxContextTokens: 200000, maxOutputTokens: 100000, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.0011, costPer1kOutput: 0.0044 },

  // ==========================================
  // Anthropic
  // ==========================================
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic', maxContextTokens: 200000, maxOutputTokens: 16000, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.003, costPer1kOutput: 0.015 },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic', maxContextTokens: 200000, maxOutputTokens: 8192, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.003, costPer1kOutput: 0.015 },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'anthropic', maxContextTokens: 200000, maxOutputTokens: 8192, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.001, costPer1kOutput: 0.005 },
  { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'anthropic', maxContextTokens: 200000, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.015, costPer1kOutput: 0.075 },
  { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', provider: 'anthropic', maxContextTokens: 200000, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.00025, costPer1kOutput: 0.00125 },

  // ==========================================
  // Google
  // ==========================================
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google', maxContextTokens: 1000000, maxOutputTokens: 65536, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.00125, costPer1kOutput: 0.01 },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google', maxContextTokens: 1000000, maxOutputTokens: 65536, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.00015, costPer1kOutput: 0.0006 },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'google', maxContextTokens: 1048576, maxOutputTokens: 8192, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.0001, costPer1kOutput: 0.0004 },
  { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', provider: 'google', maxContextTokens: 128000, maxOutputTokens: 8192, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.000075, costPer1kOutput: 0.0003 },

  // ==========================================
  // Groq (https://console.groq.com)
  // Ultra-fast inference. OpenAI-compatible format.
  // No frequency_penalty / presence_penalty support.
  // ==========================================
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', provider: 'groq', maxContextTokens: 131072, maxOutputTokens: 32768, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00059, costPer1kOutput: 0.00079 },
  { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', provider: 'groq', maxContextTokens: 131072, maxOutputTokens: 32768, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00005, costPer1kOutput: 0.00008 },
  { id: 'meta-llama/llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout 17B', provider: 'groq', maxContextTokens: 131072, maxOutputTokens: 32768, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0003, costPer1kOutput: 0.0003 },
  { id: 'moonshotai/kimi-k2-instruct', name: 'Kimi K2 Instruct', provider: 'groq', maxContextTokens: 131072, maxOutputTokens: 16384, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0005, costPer1kOutput: 0.0015 },
  { id: 'moonshotai/kimi-k2-instruct-0905', name: 'Kimi K2 Instruct (0905)', provider: 'groq', maxContextTokens: 131072, maxOutputTokens: 16384, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0005, costPer1kOutput: 0.0015 },
  { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B', provider: 'groq', maxContextTokens: 131072, maxOutputTokens: 16384, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0005, costPer1kOutput: 0.001 },
  { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B', provider: 'groq', maxContextTokens: 131072, maxOutputTokens: 16384, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0003, costPer1kOutput: 0.0006 },
  { id: 'qwen/qwen3-32b', name: 'Qwen 3 32B', provider: 'groq', maxContextTokens: 131072, maxOutputTokens: 32768, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0003, costPer1kOutput: 0.0006 },
  { id: 'allam-2-7b', name: 'ALLaM 2 7B', provider: 'groq', maxContextTokens: 8192, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00005, costPer1kOutput: 0.00008 },
  { id: 'groq/compound', name: 'Groq Compound', provider: 'groq', maxContextTokens: 131072, maxOutputTokens: 8192, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0005, costPer1kOutput: 0.0005 },
  { id: 'groq/compound-mini', name: 'Groq Compound Mini', provider: 'groq', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0001, costPer1kOutput: 0.0001 },
  { id: 'canopylabs/orpheus-v1-english', name: 'Orpheus V1 English', provider: 'groq', maxContextTokens: 8192, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00005, costPer1kOutput: 0.00008 },
  { id: 'canopylabs/orpheus-arabic-saudi', name: 'Orpheus Arabic Saudi', provider: 'groq', maxContextTokens: 8192, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00005, costPer1kOutput: 0.00008 },

  // ==========================================
  // Mistral
  // ==========================================
  { id: 'mistral-large-latest', name: 'Mistral Large', provider: 'mistral', maxContextTokens: 128000, maxOutputTokens: 8192, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.004, costPer1kOutput: 0.012 },
  { id: 'mistral-small-latest', name: 'Mistral Small', provider: 'mistral', maxContextTokens: 32000, maxOutputTokens: 8192, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.002, costPer1kOutput: 0.006 },
  { id: 'open-mistral-nemo', name: 'Mistral Nemo', provider: 'mistral', maxContextTokens: 128000, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00015, costPer1kOutput: 0.00015 },
  { id: 'codestral-latest', name: 'Codestral', provider: 'mistral', maxContextTokens: 256000, maxOutputTokens: 8192, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0003, costPer1kOutput: 0.0009 },
  { id: 'pixtral-large-latest', name: 'Pixtral Large', provider: 'mistral', maxContextTokens: 131072, maxOutputTokens: 8192, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.004, costPer1kOutput: 0.012 },

  // ==========================================
  // OpenRouter (aggregator — user picks any model)
  // ==========================================
  { id: 'openrouter-auto', name: 'OpenRouter (Auto)', provider: 'openrouter', maxContextTokens: 200000, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.001, costPer1kOutput: 0.003 },
  { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4 (OR)', provider: 'openrouter', maxContextTokens: 200000, maxOutputTokens: 16000, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.003, costPer1kOutput: 0.015 },
  { id: 'google/gemini-2.5-pro-preview', name: 'Gemini 2.5 Pro (OR)', provider: 'openrouter', maxContextTokens: 1000000, maxOutputTokens: 65536, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.00125, costPer1kOutput: 0.01 },
  { id: 'meta-llama/llama-4-maverick', name: 'Llama 4 Maverick (OR)', provider: 'openrouter', maxContextTokens: 131072, maxOutputTokens: 32768, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00015, costPer1kOutput: 0.0006 },

  // ==========================================
  // NVIDIA NIM (https://build.nvidia.com)
  // Model IDs use provider/model format per NVIDIA's API
  // Some models support reasoning via chat_template_kwargs
  // and return reasoning_content in the streaming delta
  // ==========================================

  // -- Meta Llama family --
  { id: 'meta/llama-3.1-405b-instruct', name: 'Llama 3.1 405B Instruct', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.002, costPer1kOutput: 0.002 },
  { id: 'meta/llama-3.1-70b-instruct', name: 'Llama 3.1 70B Instruct', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0007, costPer1kOutput: 0.0007 },
  { id: 'meta/llama-3.1-8b-instruct', name: 'Llama 3.1 8B Instruct', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00015, costPer1kOutput: 0.00015 },
  { id: 'meta/llama3-70b-instruct', name: 'Llama 3 70B Instruct', provider: 'nvidia', maxContextTokens: 8192, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0006, costPer1kOutput: 0.0006 },
  { id: 'meta/llama3-8b-instruct', name: 'Llama 3 8B Instruct', provider: 'nvidia', maxContextTokens: 8192, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00012, costPer1kOutput: 0.00012 },

  // -- NVIDIA Nemotron family --
  { id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'Llama 3.1 Nemotron 70B', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0005, costPer1kOutput: 0.0005 },
  { id: 'nvidia/llama-3.3-nemotron-super-49b', name: 'Llama 3.3 Nemotron Super 49B', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.001, costPer1kOutput: 0.001 },
  { id: 'nvidia/nemotron-4-340b-instruct', name: 'Nemotron 4 340B Instruct', provider: 'nvidia', maxContextTokens: 4096, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.002, costPer1kOutput: 0.002 },
  { id: 'nvidia/llama-3.1-nemotron-ultra-253b-instruct', name: 'Nemotron Ultra 253B', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.002, costPer1kOutput: 0.002 },

  // -- Mistral family (via NIM) --
  { id: 'mistralai/mistral-large-instruct-v1', name: 'Mistral Large', provider: 'nvidia', maxContextTokens: 32000, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.002, costPer1kOutput: 0.002 },
  { id: 'mistralai/mistral-medium-3-instruct', name: 'Mistral Medium 3', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 16384, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.001, costPer1kOutput: 0.001 },
  { id: 'mistralai/mixtral-8x22b-instruct-v0.1', name: 'Mixtral 8x22B Instruct', provider: 'nvidia', maxContextTokens: 65536, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0005, costPer1kOutput: 0.0005 },
  { id: 'mistralai/mixtral-8x7b-instruct-v0.1', name: 'Mixtral 8x7B Instruct', provider: 'nvidia', maxContextTokens: 32768, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00024, costPer1kOutput: 0.00024 },
  { id: 'mistralai/codestral-22b-instruct-v0.1', name: 'Codestral 22B', provider: 'nvidia', maxContextTokens: 256000, maxOutputTokens: 8192, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0003, costPer1kOutput: 0.0009 },
  { id: 'mistralai/mistral-nemo-instruct-2407', name: 'Mistral NeMo', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00015, costPer1kOutput: 0.00015 },
  { id: 'mistralai/pixtral-large-2507', name: 'Pixtral Large', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 8192, supportsStreaming: true, supportsVision: true, costPer1kInput: 0.004, costPer1kOutput: 0.012 },

  // -- Google (via NIM) --
  { id: 'google/gemma-2-27b-it', name: 'Gemma 2 27B IT', provider: 'nvidia', maxContextTokens: 8192, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00015, costPer1kOutput: 0.00015 },
  { id: 'google/gemma-2-9b-it', name: 'Gemma 2 9B IT', provider: 'nvidia', maxContextTokens: 8192, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00008, costPer1kOutput: 0.00008 },

  // -- Microsoft (via NIM) --
  { id: 'microsoft/phi-3-medium-128k-instruct', name: 'Phi-3 Medium 128K', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0001, costPer1kOutput: 0.0001 },
  { id: 'microsoft/phi-3-mini-128k-instruct', name: 'Phi-3 Mini 128K', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00005, costPer1kOutput: 0.00005 },
  { id: 'microsoft/phi-3.5-mini-instruct', name: 'Phi-3.5 Mini', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00005, costPer1kOutput: 0.00005 },
  { id: 'microsoft/phi-3.5-moe-instruct', name: 'Phi-3.5 MoE', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00012, costPer1kOutput: 0.00012 },

  // -- DeepSeek (reasoning/thinking — uses reasoning_content in delta) --
  { id: 'deepseek-ai/deepseek-r1', name: 'DeepSeek R1', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 16384, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0015, costPer1kOutput: 0.002 },
  { id: 'deepseek-ai/deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill 70B', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 16384, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00059, costPer1kOutput: 0.00079 },
  { id: 'deepseek-ai/deepseek-r1-distill-qwen-32b', name: 'DeepSeek R1 Distill Qwen 32B', provider: 'nvidia', maxContextTokens: 65536, maxOutputTokens: 16384, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00039, costPer1kOutput: 0.00039 },
  { id: 'deepseek-ai/deepseek-r1-distill-qwen-14b', name: 'DeepSeek R1 Distill Qwen 14B', provider: 'nvidia', maxContextTokens: 32768, maxOutputTokens: 16384, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00024, costPer1kOutput: 0.00024 },
  { id: 'deepseek-ai/deepseek-r1-distill-qwen-7b', name: 'DeepSeek R1 Distill Qwen 7B', provider: 'nvidia', maxContextTokens: 32768, maxOutputTokens: 16384, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00015, costPer1kOutput: 0.00015 },

  // -- IBM Granite --
  { id: 'ibm/granite-3.3-8b-instruct', name: 'Granite 3.3 8B Instruct', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 8192, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00012, costPer1kOutput: 0.00012 },
  { id: 'ibm/granite-3.3-2b-instruct', name: 'Granite 3.3 2B Instruct', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 8192, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00005, costPer1kOutput: 0.00005 },
  { id: 'ibm/granite-3.0-8b-instruct', name: 'Granite 3.0 8B Instruct', provider: 'nvidia', maxContextTokens: 8192, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00012, costPer1kOutput: 0.00012 },
  { id: 'ibm/granite-3.0-2b-instruct', name: 'Granite 3.0 2B Instruct', provider: 'nvidia', maxContextTokens: 8192, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00005, costPer1kOutput: 0.00005 },

  // -- Z-AI GLM (reasoning support) --
  { id: 'z-ai/glm4.7', name: 'GLM4.7', provider: 'nvidia', maxContextTokens: 32768, maxOutputTokens: 16384, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.001, costPer1kOutput: 0.001 },

  // -- Qwen --
  { id: 'qwen/qwen2.5-72b-instruct', name: 'Qwen 2.5 72B Instruct', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0005, costPer1kOutput: 0.0005 },
  { id: 'qwen/qwen2.5-32b-instruct', name: 'Qwen 2.5 32B Instruct', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0002, costPer1kOutput: 0.0002 },
  { id: 'qwen/qwen2.5-14b-instruct', name: 'Qwen 2.5 14B Instruct', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0001, costPer1kOutput: 0.0001 },
  { id: 'qwen/qwen2.5-7b-instruct', name: 'Qwen 2.5 7B Instruct', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.00005, costPer1kOutput: 0.00005 },
  { id: 'qwen/qwen2.5-coder-32b-instruct', name: 'Qwen 2.5 Coder 32B', provider: 'nvidia', maxContextTokens: 131072, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.0002, costPer1kOutput: 0.0002 },

  // -- Other (via NIM) --
  { id: '01-ai/yi-large', name: 'Yi Large', provider: 'nvidia', maxContextTokens: 32768, maxOutputTokens: 4096, supportsStreaming: true, supportsVision: false, costPer1kInput: 0.002, costPer1kOutput: 0.002 },

  // ==========================================
  // Local LLMs (Ollama, LM Studio, llama.cpp, etc.)
  // These use OpenAI-compatible API format
  // Model ID will be whatever you have loaded locally
  // ==========================================
  { id: 'local-custom', name: 'Local Model (Custom)', provider: 'local', maxContextTokens: 8192, maxOutputTokens: 2048, supportsStreaming: true, supportsVision: false, costPer1kInput: 0, costPer1kOutput: 0 },
];

export function getModelsForProvider(provider: AIProvider): AIModel[] {
  return AI_MODELS.filter(m => m.provider === provider);
}

export function getModelInfo(modelId: string): AIModel | undefined {
  return AI_MODELS.find(m => m.id === modelId);
}

// ---- Build System Prompt ----
export function buildSystemPrompt(character: Character, settings: AppSettings, memories: string[], summary: string): string {
  const parts: string[] = [];

  if (settings.jailbreakPrompt) {
    parts.push(settings.jailbreakPrompt);
  }

  if (settings.customSystemPrompt) {
    parts.push(settings.customSystemPrompt);
  }

  const userPersona = settings.userPersona;
  if (userPersona.name && userPersona.name !== 'You') {
    const userBlock = [
      `[Your Identity (The User)]`,
      userPersona.name ? `Name: ${userPersona.name}` : '',
      userPersona.description ? `Description: ${userPersona.description}` : '',
      userPersona.personality ? `Personality: ${userPersona.personality}` : '',
      userPersona.speechPatterns ? `Speech Style: ${userPersona.speechPatterns}` : '',
    ].filter(Boolean).join('\n');
    parts.push(userBlock);
  }

  const charBlock = [
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
  ].filter(Boolean).join('\n');
  parts.push(charBlock);

  if (character.exampleMessages) {
    parts.push(`\nExample dialogue:\n${character.exampleMessages}`);
  }

  const rpInstructions = [
    '\n[Roleplay Guidelines - IMPORTANT]',
    '- Stay in character as ${character.name}. Never break character.',
    '- NEVER include any reasoning, thinking process, metadata, or analysis in your response.',
    '- NEVER write things like "Based on...", "Reasoning:", "Analysis:", "The response should..."',
    '- ONLY output the roleplay response itself - pure narrative without any meta-commentary.',
    '- The user plays themselves. React to them naturally in character.',
    '- Use vivid, descriptive language. Show emotions through actions, dialogue, and thoughts.',
    '- Drive the story forward. Mix dialogue, action, and narration naturally.',
    '- Keep responses concise but immersive (2-4 paragraphs unless scene needs more).',
    '- Do NOT explain your choices or include any system/instruction text in the response.',
  ].join('\n');
  parts.push(rpInstructions.replace('${character.name}', character.name));

  if (summary) {
    parts.push(`\n[Conversation Summary - Remember this context]\n${summary}`);
  }

  if (memories.length > 0) {
    parts.push(`\n[Important Memories to Remember]\n${memories.join('\n')}`);
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
 * This enables deployment on static hosts (Cloudflare Pages, Netlify, GitHub Pages).
 */
export async function streamChatResponse(
  settings: AppSettings,
  messages: Array<{ role: string; content: string }>,
  signal?: AbortSignal,
  callbacks?: StreamCallbacks
): Promise<string> {
  const providerConfig = settings.providers.find(p => p.provider === settings.activeProvider && p.enabled);

  if (!providerConfig) {
    const err = `No API key configured for ${settings.activeProvider}. Please add your API key in Settings.`;
    callbacks?.onError(err);
    return '';
  }

  if (!providerConfig.apiKey || providerConfig.apiKey.trim() === '') {
    callbacks?.onError(`API key for ${settings.activeProvider} is empty. Add your API key in Settings.`);
    return '';
  }

  const provider = settings.activeProvider;
  const apiKey = providerConfig.apiKey;
  const baseUrl = providerConfig.baseUrl;

  try {
    let response: Response;
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
        callbacks?.onError(`Provider ${provider} is not supported.`);
        return '';
    }

    response = await fetch(request, { signal });

    if (signal?.aborted) {
      return '';
    }

    if (!response.ok) {
      let errorText = '';
      try {
        const errData = await response.json();
        errorText = errData.error?.message || errData.error?.code || errData.message || JSON.stringify(errData);
      } catch {
        errorText = await response.text() || `HTTP ${response.status}`;
      }
      
      let hint = '';
      if (response.status === 401 || response.status === 403) {
        hint = getAuthErrorHint(provider);
      } else if (response.status === 404) {
        hint = '\n\nCheck the model ID in Settings.';
      } else if (response.status === 429) {
        hint = '\n\nRate limited. Wait a moment and try again.';
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
    if (error instanceof Error && error.name === 'AbortError') {
      return '';
    }
    const message = error instanceof Error ? error.message : 'Network error.';
    callbacks?.onError(message);
    return '';
  }
}

function getAuthErrorHint(provider: string): string {
  switch (provider) {
    case 'groq':
      return '\n\n💡 Check your API key starts with "gsk_". Get it from https://console.groq.com/keys';
    case 'anthropic':
      return '\n\n💡 Check your Anthropic API key from https://console.anthropic.com/';
    case 'google':
      return '\n\n💡 Check your Google API key from https://aistudio.google.com/apikey';
    case 'openai':
      return '\n\n💡 Check your OpenAI API key from https://platform.openai.com/api-keys';
    case 'nvidia':
      return '\n\n💡 Check your NVIDIA API key from https://build.nvidia.com/';
    case 'mistral':
      return '\n\n💡 Check your Mistral API key from https://console.mistral.ai/';
    case 'local':
      return '\n\n💡 Make sure your local LLM server is running (Ollama, LM Studio, etc.)';
    default:
      return '\n\n💡 Check your API key is valid.';
  }
}

function buildGroqRequest(settings: AppSettings, apiKey: string, messages: Array<{ role: string; content: string }>): Request {
  const baseUrl = 'https://api.groq.com/openai/v1';

  const body: Record<string, unknown> = {
    model: settings.activeModel,
    messages,
    temperature: settings.temperature ?? 0.8,
    max_tokens: settings.maxTokens ?? 1024,
    top_p: settings.topP ?? 0.9,
    stream: settings.streamingEnabled,
  };

  return new Request(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
}

function buildOpenAIRequest(provider: string, baseUrl: string | undefined, settings: AppSettings, apiKey: string, messages: Array<{ role: string; content: string }>): Request {
  const url = baseUrl || (provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1');
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` };
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://roleplay-chat.app';
    headers['X-Title'] = 'RolePlay Chat';
  }

  const body = {
    model: settings.activeModel,
    messages,
    temperature: settings.temperature ?? 0.8,
    max_tokens: settings.maxTokens ?? 1024,
    top_p: settings.topP ?? 0.9,
    stream: settings.streamingEnabled,
  };

  return new Request(`${url}/chat/completions`, { method: 'POST', headers, body: JSON.stringify(body) });
}

function buildAnthropicRequest(baseUrl: string | undefined, settings: AppSettings, apiKey: string, messages: Array<{ role: string; content: string }>): Request {
  const url = baseUrl || 'https://api.anthropic.com/v1/messages';
  const systemMsg = messages.find(m => m.role === 'system');
  const nonSystemMsgs = messages.filter(m => m.role !== 'system');

  const chatMessages = nonSystemMsgs.map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }));

  if (chatMessages.length > 0 && chatMessages[0].role === 'assistant') {
    chatMessages.unshift({ role: 'user', content: '(Continue)' });
  }

  const body: Record<string, unknown> = {
    model: settings.activeModel,
    max_tokens: settings.maxTokens ?? 4096,
    temperature: settings.temperature ?? 0.8,
    stream: settings.streamingEnabled,
    messages: chatMessages,
  };

  if (systemMsg) body.system = systemMsg.content;

  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body),
  });
}

function buildGoogleRequest(baseUrl: string | undefined, settings: AppSettings, apiKey: string, messages: Array<{ role: string; content: string }>): Request {
  const base = baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
  const systemMsg = messages.find(m => m.role === 'system');
  const nonSystemMsgs = messages.filter(m => m.role !== 'system');

  const contents = nonSystemMsgs.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: settings.temperature ?? 0.8,
      maxOutputTokens: settings.maxTokens ?? 8192,
      topP: settings.topP ?? 0.9,
    },
  };

  if (systemMsg) body.systemInstruction = { parts: [{ text: systemMsg.content }] };

  const encodedModel = encodeURIComponent(settings.activeModel);
  const endpoint = settings.streamingEnabled ? 'streamGenerateContent' : 'generateContent';
  const suffix = settings.streamingEnabled ? '?alt=sse' : '';

  return new Request(`${base}/models/${encodedModel}:${endpoint}${suffix}&key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function buildMistralRequest(baseUrl: string | undefined, settings: AppSettings, apiKey: string, messages: Array<{ role: string; content: string }>): Request {
  const url = baseUrl || 'https://api.mistral.ai/v1';

  const body = {
    model: settings.activeModel,
    messages,
    temperature: settings.temperature ?? 0.8,
    max_tokens: settings.maxTokens ?? 1024,
    top_p: settings.topP ?? 0.9,
    random_seed: Math.floor(Math.random() * 1000000),
    stream: settings.streamingEnabled,
  };

  return new Request(`${url}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
}

function buildNvidiaRequest(baseUrl: string | undefined, settings: AppSettings, apiKey: string, messages: Array<{ role: string; content: string }>): Request {
  const url = baseUrl || 'https://integrate.api.nvidia.com/v1/chat/completions';

  const body: Record<string, unknown> = {
    model: settings.activeModel,
    messages,
    temperature: settings.temperature ?? 0.8,
    max_tokens: settings.maxTokens ?? 1024,
    top_p: settings.topP ?? 0.9,
    stream: settings.streamingEnabled,
  };

  return new Request(url, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json', 
      'Authorization': `Bearer ${apiKey}`, 
      'Accept': settings.streamingEnabled ? 'text/event-stream' : 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function buildLocalRequest(baseUrl: string | undefined, settings: AppSettings, messages: Array<{ role: string; content: string }>): Request {
  // For local LLMs, baseUrl is the full API base (e.g., http://localhost:11434/v1)
  // API key is typically not required for local servers
  const url = baseUrl || 'http://localhost:11434/v1';
  const model = settings.activeModel || 'llama3.2';

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: settings.temperature ?? 0.8,
    max_tokens: settings.maxTokens ?? 2048,
    top_p: settings.topP ?? 0.9,
    stream: settings.streamingEnabled,
  };

  return new Request(`${url}/chat/completions`, {
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
  callbacks?: StreamCallbacks
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    callbacks?.onError('No response stream received');
    return;
  }

  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  // Set up abort listener
  const abortHandler = () => {
    reader.cancel().catch(() => {});
  };
  signal?.addEventListener('abort', abortHandler);

  try {
    while (true) {
      if (signal?.aborted) break;

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (signal?.aborted) break;

        const trimmed = line.trim();
        if (!trimmed) continue;

        // Handle SSE event: lines (Groq Responses API sends `event: response.output_text.delta`)
        if (trimmed.startsWith('event:')) continue;
        if (!trimmed.startsWith('data:')) continue;

        const dataStr = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed.slice(5);

        // OpenAI-compatible streams end with [DONE]
        if (dataStr === '[DONE]') {
          callbacks?.onDone(fullText);
          signal?.removeEventListener('abort', abortHandler);
          return;
        }

        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(dataStr);
        } catch {
          continue;
        }

        // Extract content token
        const token = extractTokenFromChunk(parsed, provider);
        if (token) {
          fullText += token;
          callbacks?.onToken(token);
        }

        // Extract reasoning/thinking content
        const reasoning = extractReasoningFromChunk(parsed, provider);
        if (reasoning) {
          callbacks?.onThinking?.(reasoning);
        }
      }
    }

    // Process remaining buffer
    if (buffer.trim() && !signal?.aborted) {
      const trimmed = buffer.trim();
      if (trimmed.startsWith('data:')) {
        const dataStr = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed.slice(5);
        if (dataStr && dataStr !== '[DONE]') {
          try {
            const parsed = JSON.parse(dataStr);
            const token = extractTokenFromChunk(parsed, provider);
            if (token) { fullText += token; callbacks?.onToken(token); }
            const reasoning = extractReasoningFromChunk(parsed, provider);
            if (reasoning) { callbacks?.onThinking?.(reasoning); }
          } catch { /* skip */ }
        }
      }
    }

    callbacks?.onDone(fullText);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return;
    }
    const message = error instanceof Error ? error.message : 'Stream reading error';
    callbacks?.onError(message);
  } finally {
    signal?.removeEventListener('abort', abortHandler);
  }
}

/**
 * Extract reasoning/thinking content from a chunk.
 *
 * NVIDIA NIM and DeepSeek-style models send `reasoning_content` in the
 * streaming delta for thinking/reasoning models (DeepSeek R1, GLM4.7,
 * Granite 3.3 thinking, etc.):
 *   { choices: [{ delta: { reasoning_content: "thinking..." } }] }
 *
 * Anthropic sends `thinking_delta` blocks:
 *   { type: "content_block_delta", delta: { type: "thinking_delta", thinking: "..." } }
 */
function extractReasoningFromChunk(chunk: Record<string, unknown>, _provider: string): string {
  // OpenAI-compatible reasoning (NVIDIA NIM, DeepSeek, some OpenRouter models)
  if (chunk.choices && Array.isArray(chunk.choices) && chunk.choices.length > 0) {
    const choice = chunk.choices[0] as Record<string, unknown>;
    const delta = choice.delta as Record<string, unknown> | undefined;
    if (delta && typeof delta === 'object' && 'reasoning_content' in delta) {
      const reasoning = (delta as { reasoning_content: string | null }).reasoning_content;
      if (reasoning) return reasoning;
    }
  }

  // Anthropic thinking
  if (
    chunk.type === 'content_block_delta' &&
    (chunk.delta as Record<string, unknown>)?.type === 'thinking_delta'
  ) {
    return (chunk.delta as { thinking: string }).thinking || '';
  }

  return '';
}

// ---- Extract a text token from a single SSE chunk ----
function extractTokenFromChunk(chunk: Record<string, unknown>, _provider: string): string {
  // OpenAI-compatible (Groq, OpenAI, Mistral, OpenRouter, NVIDIA, Custom)
  // { choices: [{ delta: { content: "token" }, ... }] }
  if (chunk.choices && Array.isArray(chunk.choices) && chunk.choices.length > 0) {
    const choice = chunk.choices[0] as Record<string, unknown>;
    const delta = choice.delta as Record<string, unknown> | undefined;
    if (delta && typeof delta === 'object' && 'content' in delta) {
      const content = (delta as { content: string | null }).content;
      if (content) return content;
    }
    return '';
  }

  // Anthropic Messages API
  // { type: "content_block_delta", delta: { type: "text_delta", text: "token" } }
  if (chunk.type === 'content_block_delta') {
    const delta = chunk.delta as Record<string, unknown> | undefined;
    if (delta && delta.type === 'text_delta') {
      return (delta as { text: string }).text || '';
    }
    return '';
  }

  // Google Gemini SSE
  // { candidates: [{ content: { parts: [{ text: "token" }] } }] }
  if (chunk.candidates && Array.isArray(chunk.candidates) && chunk.candidates.length > 0) {
    const candidate = chunk.candidates[0] as Record<string, unknown>;
    const content = candidate.content as Record<string, unknown> | undefined;
    if (content && typeof content === 'object' && 'parts' in content) {
      const parts = (content as { parts: Array<{ text?: string }> }).parts;
      if (parts && parts.length > 0 && parts[0].text) {
        return parts[0].text;
      }
    }
    return '';
  }

  return '';
}

// ---- Extract full text from a non-streaming JSON response ----
function extractTextFromResponse(data: Record<string, unknown>, _provider: string): string {
  // OpenAI-compatible (Groq, OpenAI, Mistral, OpenRouter, NVIDIA, Custom)
  if (data.choices && Array.isArray(data.choices) && data.choices.length > 0) {
    const message = (data.choices[0] as Record<string, unknown>).message;
    if (message && typeof message === 'object' && 'content' in message) {
      return (message as { content: string }).content || '';
    }
  }

  // Anthropic
  if (data.content && Array.isArray(data.content)) {
    return (data.content as Array<{ type: string; text?: string }>)
      .filter(c => c.type === 'text')
      .map(c => c.text || '')
      .join('');
  }

  // Google
  if (data.candidates && Array.isArray(data.candidates) && data.candidates.length > 0) {
    const content = (data.candidates[0] as Record<string, unknown>).content;
    if (content && typeof content === 'object' && 'parts' in content) {
      const parts = (content as { parts: Array<{ text?: string }> }).parts;
      return parts.map(p => p.text || '').join('');
    }
  }

  return '';
}

// ---- Token estimation ----
export function estimateTokens(text: string): number {
  if (!text) return 0;
  let tokens = 0;
  for (const char of text) {
    if (/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/.test(char)) {
      tokens += 1.5;
    } else if (/\s/.test(char)) {
      // space = word boundary
    } else {
      tokens += 0.25;
    }
  }
  return Math.ceil(tokens);
}

export function estimateMessageTokens(messages: Array<{ role: string; content: string }>): number {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content) + 4, 0);
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
  options: GenerateCharacterOptions = {}
): Promise<GeneratedCharacter | null> {
  const providerConfig = settings.providers.find(p => p.provider === settings.activeProvider && p.enabled);
  if (!providerConfig) {
    throw new Error('No API key configured. Please add an API key in Settings.');
  }

  const { userPrompt, characterType } = options;
  
  let systemPrompt = CHARACTER_GENERATION_PROMPT;
  if (characterType) {
    systemPrompt += `\n\nCharacter type/style to focus on: ${characterType}`;
  }
  if (userPrompt) {
    systemPrompt += `\n\nUser's request: "${userPrompt}"`;
  }

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: userPrompt || 'Generate a unique and interesting character.' },
  ];

  let fullText = '';

  try {
    await streamChatResponse(settings, messages, undefined, {
      onToken: (token) => { fullText += token; },
      onDone: () => {},
      onError: () => {},
    });
  } catch {
    throw new Error('Failed to generate character. Please try again.');
  }

  // Parse the JSON response
  try {
    // Try to extract JSON from the response
    let jsonStr = fullText.trim();
    
    // Remove markdown code blocks if present
    jsonStr = jsonStr.replace(/^```json\s*/i, '');
    jsonStr = jsonStr.replace(/^```\s*/i, '');
    jsonStr = jsonStr.replace(/\s*```$/i, '');
    
    // Find JSON array or object
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse character data');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate and normalize
    const character: GeneratedCharacter = {
      name: parsed.name || 'Unnamed Character',
      description: parsed.description || '',
      personality: parsed.personality || '',
      scenario: parsed.scenario || '',
      firstMessage: parsed.firstMessage || '',
      speechPatterns: parsed.speechPatterns || '',
      likes: parsed.likes || '',
      dislikes: parsed.dislikes || '',
      behavior: parsed.behavior || '',
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 8) : [],
    };

    return character;
  } catch (e) {
    console.error('Character parsing error:', e);
    throw new Error('Failed to parse generated character. Please try again.');
  }
}
