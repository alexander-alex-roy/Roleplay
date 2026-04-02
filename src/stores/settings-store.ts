// ============================================================
// Settings Store - Global app settings
// ============================================================

import { create } from 'zustand';
import type { AppSettings, AIProvider, ProviderConfig, UserPersona } from '@/lib/types';
import { settingsDB } from '@/lib/db';

interface SettingsState {
  settings: AppSettings;
  isLoaded: boolean;
  loadSettings: () => Promise<void>;
  saveSettings: (settings: AppSettings) => Promise<void>;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
  setProvider: (config: ProviderConfig) => Promise<void>;
  removeProvider: (provider: AIProvider) => Promise<void>;
  setActiveProvider: (provider: AIProvider) => Promise<void>;
  setActiveModel: (model: string) => Promise<void>;
  getActiveProviderConfig: () => ProviderConfig | undefined;
  testConnection: () => Promise<{ success: boolean; message: string }>;
  updateUserPersona: (persona: Partial<UserPersona>) => Promise<void>;
  dismissSetupWizard: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: settingsDB.getDefaults(),
  isLoaded: false,

  loadSettings: async () => {
    const settings = await settingsDB.get();
    set({ settings, isLoaded: true });
  },

  saveSettings: async (settings: AppSettings) => {
    await settingsDB.save(settings);
    set({ settings });
  },

  updateSetting: async (key, value) => {
    const newSettings = { ...get().settings, [key]: value };
    await settingsDB.save(newSettings);
    set({ settings: newSettings });
  },

  setProvider: async (config: ProviderConfig) => {
    // CRITICAL: Trim the API key. Users often paste with trailing whitespace,
    // newlines, quotes, or zero-width chars which causes 403 Forbidden.
    const raw = config.apiKey;
    const clean = raw
      .trim()
      .replace(/[\u200B-\u200D\uFEFF]/g, '')  // zero-width chars
      .replace(/^['"]|['"]$/g, '');             // surrounding quotes

    // Validate key format per provider
    if (clean.length > 0) {
      const formatIssues: string[] = [];
      switch (config.provider) {
        case 'groq':
          if (!clean.startsWith('gsk_')) formatIssues.push('Groq keys start with gsk_');
          break;
        case 'openai':
          if (!clean.startsWith('sk-')) formatIssues.push('OpenAI keys start with sk-');
          break;
        case 'anthropic':
          if (!clean.startsWith('sk-ant-')) formatIssues.push('Anthropic keys start with sk-ant-');
          break;
        case 'mistral':
          // Mistral keys vary, no strict prefix
          break;
        case 'nvidia':
          if (!clean.startsWith('nvapi-')) formatIssues.push('NVIDIA keys start with nvapi-');
          break;
        case 'google':
          if (clean.length < 20) formatIssues.push('Google API keys are typically 39 characters');
          break;
      }
      if (formatIssues.length > 0) {
        console.warn(`[settings] Key format warning for ${config.provider}: ${formatIssues.join('; ')}`);
      }
    }

    const cleanConfig = { ...config, apiKey: clean };
    const { settings } = get();
    const existing = settings.providers.findIndex(p => p.provider === config.provider);
    const newProviders = [...settings.providers];
    if (existing >= 0) {
      newProviders[existing] = cleanConfig;
    } else {
      newProviders.push(cleanConfig);
    }
    const newSettings = { ...settings, providers: newProviders };
    await settingsDB.save(newSettings);
    set({ settings: newSettings });
  },

  removeProvider: async (provider: AIProvider) => {
    const { settings } = get();
    const newProviders = settings.providers.filter(p => p.provider !== provider);
    const newSettings = { ...settings, providers: newProviders };
    await settingsDB.save(newSettings);
    set({ settings: newSettings });
  },

  setActiveProvider: async (provider: AIProvider) => {
    const { settings } = get();
    const newSettings = { ...settings, activeProvider: provider };
    await settingsDB.save(newSettings);
    set({ settings: newSettings });
  },

  setActiveModel: async (model: string) => {
    const { settings } = get();
    const newSettings = { ...settings, activeModel: model };
    await settingsDB.save(newSettings);
    set({ settings: newSettings });
  },

  getActiveProviderConfig: () => {
    const { settings } = get();
    return settings.providers.find(p => p.provider === settings.activeProvider && p.enabled);
  },

  /** Test if the active provider's API key works */
  testConnection: async (): Promise<{ success: boolean; message: string }> => {
    const { settings } = get();
    const providerConfig = settings.providers.find(p => p.provider === settings.activeProvider && p.enabled);
    if (!providerConfig) {
      return { success: false, message: `No API key configured for ${settings.activeProvider}.` };
    }
    const key = providerConfig.apiKey;
    if (!key || key.trim().length === 0) {
      return { success: false, message: 'API key is empty.' };
    }
    try {
      const model = settings.activeModel;
      let url = '';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      let body: Record<string, unknown> = {};

      switch (settings.activeProvider) {
        case 'groq':
          url = 'https://api.groq.com/openai/v1/chat/completions';
          headers['Authorization'] = `Bearer ${key}`;
          body = { model, messages: [{ role: 'user', content: 'Hi' }], max_tokens: 10 };
          break;
        case 'openai':
          url = 'https://api.openai.com/v1/chat/completions';
          headers['Authorization'] = `Bearer ${key}`;
          body = { model, messages: [{ role: 'user', content: 'Hi' }], max_tokens: 10 };
          break;
        case 'anthropic':
          url = 'https://api.anthropic.com/v1/messages';
          headers['Authorization'] = `Bearer ${key}`;
          headers['x-api-key'] = key;
          headers['anthropic-version'] = '2023-06-01';
          body = { model, max_tokens: 10, messages: [{ role: 'user', content: 'Hi' }] };
          break;
        case 'google':
          url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
          body = { contents: [{ role: 'user', parts: [{ text: 'Hi' }] }], generationConfig: { maxOutputTokens: 10 } };
          break;
        case 'mistral':
          url = 'https://api.mistral.ai/v1/chat/completions';
          headers['Authorization'] = `Bearer ${key}`;
          body = { model, messages: [{ role: 'user', content: 'Hi' }], max_tokens: 10 };
          break;
        case 'openrouter':
          url = 'https://openrouter.ai/api/v1/chat/completions';
          headers['Authorization'] = `Bearer ${key}`;
          headers['HTTP-Referer'] = 'https://roleplay-chat.app';
          headers['X-Title'] = 'RolePlay Chat';
          body = { model, messages: [{ role: 'user', content: 'Hi' }], max_tokens: 10 };
          break;
        case 'nvidia':
          // Use Cloudflare Worker proxy to avoid CORS
          url = 'https://roleplay.jameskaren.workers.dev/';
          body = { model, messages: [{ role: 'user', content: 'Hi' }], max_tokens: 10, apiKey: key };
          break;
        default:
          return { success: false, message: `Provider ${settings.activeProvider} not supported.` };
      }

      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      if (res.ok) {
        return { success: true, message: `Connected! ${settings.activeProvider} is working. ✓` };
      }
      const errorText = await res.text();
      let errorMsg = `${settings.activeProvider} error (${res.status})`;
      try {
        const errJson = JSON.parse(errorText);
        if (errJson.error?.message) errorMsg += `: ${errJson.error.message}`;
        else if (errJson.message) errorMsg += `: ${errJson.message}`;
      } catch { /* use default */ }
      return { success: false, message: errorMsg };
    } catch (e) {
      return { success: false, message: `Network error: ${e instanceof Error ? e.message : 'Unknown'}` };
    }
  },

  updateUserPersona: async (persona: Partial<UserPersona>) => {
    const { settings } = get();
    const newSettings = {
      ...settings,
      userPersona: { ...settings.userPersona, ...persona },
    };
    await settingsDB.save(newSettings);
    set({ settings: newSettings });
  },

  dismissSetupWizard: async () => {
    const { settings } = get();
    const newSettings = { ...settings, showSetupWizard: false };
    await settingsDB.save(newSettings);
    set({ settings: newSettings });
  },
}));
