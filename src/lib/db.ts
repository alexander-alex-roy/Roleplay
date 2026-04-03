// ============================================================
// IndexedDB Storage Layer
// Privacy-first: All data stays on user's device
// ============================================================

import type { Character, Chat, ChatMessage, MemoryEntry, AppSettings, ProviderConfig, UserPersona } from './types';
import { DEFAULT_USER_PERSONA } from './types';

const DB_NAME = 'roleplay-chat';
const DB_VERSION = 1;

interface RPChatDB {
  characters: Character;
  chats: Chat;
  messages: ChatMessage;
  memories: MemoryEntry;
  settings: AppSettings;
}

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Characters store
      if (!db.objectStoreNames.contains('characters')) {
        const charStore = db.createObjectStore('characters', { keyPath: 'id' });
        charStore.createIndex('name', 'name', { unique: false });
        charStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        charStore.createIndex('isFavorite', 'isFavorite', { unique: false });
      }

      // Chats store
      if (!db.objectStoreNames.contains('chats')) {
        const chatStore = db.createObjectStore('chats', { keyPath: 'id' });
        chatStore.createIndex('characterId', 'characterId', { unique: false });
        chatStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      // Messages store
      if (!db.objectStoreNames.contains('messages')) {
        const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
        msgStore.createIndex('chatId', 'chatId', { unique: false });
        msgStore.createIndex('timestamp', 'timestamp', { unique: false });
        msgStore.createIndex('characterId', 'characterId', { unique: false });
      }

      // Memories store
      if (!db.objectStoreNames.contains('memories')) {
        const memStore = db.createObjectStore('memories', { keyPath: 'id' });
        memStore.createIndex('characterId', 'characterId', { unique: false });
        memStore.createIndex('chatId', 'chatId', { unique: false });
        memStore.createIndex('type', 'type', { unique: false });
        memStore.createIndex('importance', 'importance', { unique: false });
        memStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Settings store (single record)
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }
    };
  });
}

// ---- Generic CRUD helpers ----
async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getById<T>(storeName: string, id: string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function put<T>(storeName: string, item: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function del(storeName: string, id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getByIndex<T>(storeName: string, indexName: string, value: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(value);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function count(storeName: string): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ---- Character operations ----
export const characterDB = {
  getAll: () => getAll<Character>('characters'),
  getById: (id: string) => getById<Character>('characters', id),
  save: (char: Character) => put('characters', { ...char, updatedAt: Date.now() }),
  delete: (id: string) => del('characters', id),
  getByIndex: (indexName: string, value: string) => getByIndex<Character>('characters', indexName, value),
};

// ---- Chat operations ----
export const chatDB = {
  getAll: () => getAll<Chat>('chats'),
  getById: (id: string) => getById<Chat>('chats', id),
  getByCharacterId: (characterId: string) => getByIndex<Chat>('chats', 'characterId', characterId),
  save: (chat: Chat) => put('chats', { ...chat, updatedAt: Date.now() }),
  delete: (id: string) => del('chats', id),
};

// ---- Message operations ----
export const messageDB = {
  getAll: () => getAll<ChatMessage>('messages'),
  getById: (id: string) => getById<ChatMessage>('messages', id),
  getByChatId: (chatId: string) => getByIndex<ChatMessage>('messages', 'chatId', chatId),
  getByCharacterId: (characterId: string) => getByIndex<ChatMessage>('messages', 'characterId', characterId),
  save: (msg: ChatMessage) => put('messages', msg),
  saveMany: async (msgs: ChatMessage[]) => {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction('messages', 'readwrite');
      const store = tx.objectStore('messages');
      for (const msg of msgs) {
        store.put(msg);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  delete: (id: string) => del('messages', id),
  deleteByChatId: async (chatId: string) => {
    const msgs = await getByIndex<ChatMessage>('messages', 'chatId', chatId);
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction('messages', 'readwrite');
      const store = tx.objectStore('messages');
      for (const msg of msgs) {
        store.delete(msg.id);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  count: () => count('messages'),
};

// ---- Memory operations ----
export const memoryDB = {
  getAll: () => getAll<MemoryEntry>('memories'),
  getById: (id: string) => getById<MemoryEntry>('memories', id),
  getByCharacterId: (characterId: string) => getByIndex<MemoryEntry>('memories', 'characterId', characterId),
  getByChatId: (chatId: string) => getByIndex<MemoryEntry>('memories', 'chatId', chatId),
  getByType: (type: string) => getByIndex<MemoryEntry>('memories', 'type', type),
  save: (mem: MemoryEntry) => put('memories', mem),
  saveMany: async (mems: MemoryEntry[]) => {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction('memories', 'readwrite');
      const store = tx.objectStore('memories');
      for (const mem of mems) {
        store.put(mem);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  delete: (id: string) => del('memories', id),
  deleteByCharacterId: async (characterId: string) => {
    const mems = await getByIndex<MemoryEntry>('memories', 'characterId', characterId);
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction('memories', 'readwrite');
      const store = tx.objectStore('memories');
      for (const mem of mems) {
        store.delete(mem.id);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  count: () => count('memories'),
};

// ---- Settings operations ----
const SETTINGS_ID = 'app-settings';

const DEFAULT_SETTINGS: AppSettings = {
  providers: [],
  activeProvider: 'groq',
  activeModel: 'llama-3.3-70b-versatile',
  temperature: 0.7,
  maxTokens: 512,
  topP: 0.9,
  frequencyPenalty: 0.1,
  presencePenalty: 0.1,
  memoryEnabled: true,
  autoExtractMemories: true,
  maxMemoriesPerQuery: 10,
  memoryImportanceThreshold: 3,
  contextWindow: 32,
  summarizeThreshold: 6,
  keepRecentCount: 6,
  theme: 'system',
  fontSize: 'medium',
  showTimestamps: true,
  showTokenCount: false,
  sendOnEnter: true,
  streamingEnabled: true,
  customSystemPrompt: '',
  jailbreakPrompt: '',
  userPersona: { ...DEFAULT_USER_PERSONA },
  nvidiaImageModel: 'stable-diffusion-3-medium',
  showSetupWizard: true,
};

export const settingsDB = {
  get: async (): Promise<AppSettings> => {
    try {
      const result = await getById<AppSettings & { id: string }>('settings', SETTINGS_ID);
      if (result) {
        // Merge with defaults to handle new settings added in updates
        return { ...DEFAULT_SETTINGS, ...result };
      }
      return DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  },
  save: async (settings: AppSettings): Promise<void> => {
    await put('settings', { ...settings, id: SETTINGS_ID });
  },
  getDefaults: () => DEFAULT_SETTINGS,
};

// ---- Data Export/Import (Privacy: user controls their data) ----
export async function exportAllData(): Promise<string> {
  const data = {
    characters: await characterDB.getAll(),
    chats: await chatDB.getAll(),
    messages: await messageDB.getAll(),
    memories: await memoryDB.getAll(),
    settings: await settingsDB.get(),
    exportedAt: Date.now(),
    version: '1.0',
  };
  return JSON.stringify(data, null, 2);
}

export async function importAllData(json: string): Promise<void> {
  const data = JSON.parse(json) as {
    characters?: Character[];
    chats?: Chat[];
    messages?: ChatMessage[];
    memories?: MemoryEntry[];
    settings?: AppSettings;
  };

  if (data.characters?.length) {
    const db = await openDB();
    const tx = db.transaction('characters', 'readwrite');
    const store = tx.objectStore('characters');
    for (const char of data.characters) store.put(char);
    await new Promise<void>((resolve) => { tx.oncomplete = () => resolve(); });
  }
  if (data.chats?.length) {
    const db = await openDB();
    const tx = db.transaction('chats', 'readwrite');
    const store = tx.objectStore('chats');
    for (const chat of data.chats) store.put(chat);
    await new Promise<void>((resolve) => { tx.oncomplete = () => resolve(); });
  }
  if (data.messages?.length) {
    const db = await openDB();
    const tx = db.transaction('messages', 'readwrite');
    const store = tx.objectStore('messages');
    for (const msg of data.messages) store.put(msg);
    await new Promise<void>((resolve) => { tx.oncomplete = () => resolve(); });
  }
  if (data.memories?.length) {
    const db = await openDB();
    const tx = db.transaction('memories', 'readwrite');
    const store = tx.objectStore('memories');
    for (const mem of data.memories) store.put(mem);
    await new Promise<void>((resolve) => { tx.oncomplete = () => resolve(); });
  }
  if (data.settings) {
    await settingsDB.save(data.settings);
  }
}

// ---- Clear all data ----
export async function clearAllData(): Promise<void> {
  const db = await openDB();
  const storeNames = ['characters', 'chats', 'messages', 'memories', 'settings'];
  const tx = db.transaction(storeNames, 'readwrite');
  for (const name of storeNames) {
    tx.objectStore(name).clear();
  }
  await new Promise<void>((resolve) => { tx.oncomplete = () => resolve(); });
}
