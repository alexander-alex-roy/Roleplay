// ============================================================
// Chat Store - Main chat state management
// ============================================================

import { create } from 'zustand';
import type { Character, Chat, ChatMessage, MemoryEntry } from '@/lib/types';
import { characterDB, chatDB, messageDB, memoryDB } from '@/lib/db';
import { useSettingsStore } from './settings-store';
import { buildContextWindow } from '@/lib/context';
import { streamChatResponse } from '@/lib/ai-engine';
import { extractMemories } from '@/lib/memory';

interface ChatState {
  // Data
  characters: Character[];
  chats: Chat[];
  messages: ChatMessage[];
  memories: MemoryEntry[];

  // Active selections
  activeCharacter: Character | null;
  activeChat: Chat | null;
  contextSummary: string;

  // UI State
  isLoading: boolean;
  isStreaming: boolean;
  streamingMessageId: string | null;
  error: string | null;
  sidebarOpen: boolean;
  memoryPanelOpen: boolean;
  settingsOpen: boolean;
  characterEditorOpen: boolean;
  editingCharacter: Character | null;

  // Character actions
  loadCharacters: () => Promise<void>;
  saveCharacter: (character: Character) => Promise<void>;
  deleteCharacter: (id: string) => Promise<void>;
  selectCharacter: (character: Character) => Promise<void>;
  importCharacter: (json: string) => Promise<Character | null>;
  exportCharacter: (character: Character) => string;

  // Chat actions
  loadChats: (characterId: string) => Promise<void>;
  loadMessages: (chatId: string) => Promise<void>;
  selectChat: (chat: Chat) => Promise<void>;
  newChat: (character: Character) => Promise<void>;
  deleteChat: (id: string) => Promise<void>;

  // Message actions
  sendMessage: (content: string) => Promise<void>;
  stopStreaming: () => void;
  regenerateMessage: () => Promise<void>;

  // Memory actions
  loadMemories: (characterId: string) => Promise<void>;
  deleteMemory: (id: string) => Promise<void>;

  // UI actions
  setSidebarOpen: (open: boolean) => void;
  setMemoryPanelOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setCharacterEditorOpen: (open: boolean, character?: Character | null) => void;
  clearError: () => void;
}

let msgIdCounter = 0;
function genMsgId(): string {
  msgIdCounter++;
  return `msg_${Date.now()}_${msgIdCounter}_${Math.random().toString(36).slice(2, 6)}`;
}

function genChatId(): string {
  return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

let abortController: AbortController | null = null;

export const useChatStore = create<ChatState>((set, get) => ({
  characters: [],
  chats: [],
  messages: [],
  memories: [],
  activeCharacter: null,
  activeChat: null,
  contextSummary: '',
  isLoading: true,
  isStreaming: false,
  streamingMessageId: null,
  error: null,
  sidebarOpen: true,
  memoryPanelOpen: false,
  settingsOpen: false,
  characterEditorOpen: false,
  editingCharacter: null,

  // ---- Character Actions ----
  loadCharacters: async () => {
    try {
      const characters = await characterDB.getAll();
      characters.sort((a, b) => b.updatedAt - a.updatedAt);
      set({ characters, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  saveCharacter: async (character: Character) => {
    await characterDB.save(character);
    const characters = await characterDB.getAll();
    characters.sort((a, b) => b.updatedAt - a.updatedAt);
    set({ characters });
  },

  deleteCharacter: async (id: string) => {
    const { activeCharacter } = get();
    await characterDB.delete(id);
    // Also delete associated chats and messages
    const chats = await chatDB.getByCharacterId(id);
    for (const chat of chats) {
      await messageDB.deleteByChatId(chat.id);
      await chatDB.delete(chat.id);
    }
    await memoryDB.deleteByCharacterId(id);

    const characters = await characterDB.getAll();
    characters.sort((a, b) => b.updatedAt - a.updatedAt);

    if (activeCharacter?.id === id) {
      set({ characters, activeCharacter: null, activeChat: null, chats: [], messages: [] });
    } else {
      set({ characters });
    }
  },

  selectCharacter: async (character: Character) => {
    const { messages, contextSummary } = get();
    set({ activeCharacter: character, messages: [], activeChat: null, contextSummary: '', memoryPanelOpen: false });
    await get().loadChats(character.id);
  },

  importCharacter: async (json: string): Promise<Character | null> => {
    try {
      const parsed = JSON.parse(json);

      // Character Card V2 format
      if (parsed.spec === 'chara_card_v2' && parsed.data) {
        const d = parsed.data;
        const character: Character = {
          id: `char_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: d.name || 'Unnamed',
          avatar: undefined,
          description: d.description || '',
          personality: d.personality || '',
          scenario: d.scenario || '',
          firstMessage: d.first_mes || '',
          exampleMessages: d.mes_example || '',
          systemPrompt: d.system_prompt || undefined,
          creatorNotes: d.creator_notes || '',
          tags: d.tags || [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isFavorite: false,
          behavior: d.post_history_instructions || undefined,
        };
        await characterDB.save(character);
        await get().loadCharacters();
        return character;
      }

      // Direct character format
      if (parsed.name) {
        const character: Character = {
          id: `char_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: parsed.name,
          avatar: parsed.avatar,
          description: parsed.description || '',
          personality: parsed.personality || '',
          scenario: parsed.scenario || '',
          firstMessage: parsed.firstMessage || parsed.first_mes || '',
          exampleMessages: parsed.exampleMessages || parsed.mes_example || '',
          systemPrompt: parsed.systemPrompt || parsed.system_prompt,
          creatorNotes: parsed.creatorNotes || parsed.creator_notes || '',
          tags: parsed.tags || [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isFavorite: false,
          speechPatterns: parsed.speechPatterns,
          knowledge: parsed.knowledge,
          relationship: parsed.relationship,
          likes: parsed.likes,
          dislikes: parsed.dislikes,
          behavior: parsed.behavior || parsed.post_history_instructions,
        };
        await characterDB.save(character);
        await get().loadCharacters();
        return character;
      }

      return null;
    } catch {
      return null;
    }
  },

  exportCharacter: (character: Character): string => {
    const card = {
      spec: 'chara_card_v2',
      spec_version: '2.0',
      data: {
        name: character.name,
        description: character.description,
        personality: character.personality,
        scenario: character.scenario,
        first_mes: character.firstMessage,
        mes_example: character.exampleMessages || '',
        creator_notes: character.creatorNotes,
        system_prompt: character.systemPrompt,
        post_history_instructions: character.behavior,
        tags: character.tags,
      },
    };
    return JSON.stringify(card, null, 2);
  },

  // ---- Chat Actions ----
  loadChats: async (characterId: string) => {
    const chats = await chatDB.getByCharacterId(characterId);
    chats.sort((a, b) => b.updatedAt - a.updatedAt);
    set({ chats });
  },

  loadMessages: async (chatId: string) => {
    const messages = await messageDB.getByChatId(chatId);
    messages.sort((a, b) => a.timestamp - b.timestamp);
    set({ messages });
  },

  selectChat: async (chat: Chat) => {
    set({ activeChat: chat, contextSummary: '' });
    await get().loadMessages(chat.id);
  },

  newChat: async (character: Character) => {
    const chat: Chat = {
      id: genChatId(),
      characterId: character.id,
      title: 'New Chat',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 0,
    };

    await chatDB.save(chat);

    const initialMessages: ChatMessage[] = [];

    // Send first message from character
    if (character.firstMessage) {
      const firstMsg: ChatMessage = {
        id: genMsgId(),
        role: 'assistant',
        content: character.firstMessage,
        timestamp: Date.now(),
        characterId: character.id,
        chatId: chat.id,
        metadata: { memoryExtracted: true },
      };
      await messageDB.save(firstMsg);
      initialMessages.push(firstMsg);

      chat.messageCount = 1;
      chat.title = character.firstMessage.slice(0, 50) + (character.firstMessage.length > 50 ? '...' : '');
      await chatDB.save(chat);
    }

    set({ activeChat: chat, messages: initialMessages });
    await get().loadChats(character.id);
  },

  deleteChat: async (id: string) => {
    const { activeChat } = get();
    await messageDB.deleteByChatId(id);
    await chatDB.delete(id);

    if (activeChat?.id === id) {
      set({ activeChat: null, messages: [] });
    }

    const { activeCharacter } = get();
    if (activeCharacter) {
      await get().loadChats(activeCharacter.id);
    }
  },

  // ---- Message Actions ----
  sendMessage: async (content: string) => {
    const { activeCharacter, activeChat, messages } = get();
    if (!activeCharacter || !activeChat || !content.trim()) return;

    const settings = useSettingsStore.getState().settings;
    const providerConfig = settings.providers.find(p => p.provider === settings.activeProvider && p.enabled);

    if (!providerConfig) {
      set({ error: `No API key configured for ${settings.activeProvider}. Please add your key in Settings (⚙️).` });
      return;
    }

    // Add user message
    const userMsg: ChatMessage = {
      id: genMsgId(),
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
      characterId: activeCharacter.id,
      chatId: activeChat.id,
    };
    await messageDB.save(userMsg);

    const allMessages = [...messages, userMsg];
    set({ messages: allMessages, error: null });

    // Build context window
    let apiMessages: Array<{ role: string; content: string }>;
    try {
      const result = await buildContextWindow(allMessages, activeCharacter, settings, get().contextSummary);
      set({ contextSummary: result.contextWindow.summary });
      apiMessages = result.messages;
    } catch (e) {
      set({ error: 'Failed to build context: ' + (e instanceof Error ? e.message : 'Unknown error') });
      return;
    }

    // Create placeholder for assistant response
    const assistantMsgId = genMsgId();
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      characterId: activeCharacter.id,
      chatId: activeChat.id,
      isStreaming: true,
      metadata: { model: settings.activeModel, provider: settings.activeProvider },
    };

    set({
      messages: [...allMessages, assistantMsg],
      isStreaming: true,
      streamingMessageId: assistantMsgId,
    });

    abortController = new AbortController();
    let fullText = '';

    // Stream response
    await streamChatResponse(settings, apiMessages, abortController.signal, {
      onToken: (token: string) => {
        fullText += token;
        set((state) => ({
          messages: state.messages.map(m =>
            m.id === assistantMsgId ? { ...m, content: m.content + token } : m
          ),
        }));
      },
      onDone: async () => {
        abortController = null;

        // Save complete message
        const completedMsg: ChatMessage = {
          ...assistantMsg,
          content: fullText,
          isStreaming: false,
          tokenCount: fullText.length,
        };
        await messageDB.save(completedMsg);

        // Update chat
        const chat = get().activeChat;
        if (chat) {
          const updatedChat: Chat = {
            ...chat,
            messageCount: (chat.messageCount || 0) + 1,
            updatedAt: Date.now(),
            lastMessageAt: Date.now(),
            title: chat.messageCount === 0 ? content.trim().slice(0, 50) : chat.title,
          };
          await chatDB.save(updatedChat);
          set({ activeChat: updatedChat, isStreaming: false, streamingMessageId: null });
          if (get().activeCharacter) {
            await get().loadChats(get().activeCharacter!.id);
          }
        } else {
          set({ isStreaming: false, streamingMessageId: null });
        }

        // Extract memories in background (non-blocking)
        if (settings.memoryEnabled && settings.autoExtractMemories) {
          const existingMemories = await memoryDB.getByCharacterId(activeCharacter.id);
          extractMemories(
            [userMsg, completedMsg],
            activeCharacter,
            settings,
            existingMemories
          ).catch((error) => {
            console.error('Memory extraction failed:', error);
          });
        }
      },
      onError: (error: string) => {
        abortController = null;
        set((state) => ({
          messages: state.messages.map(m =>
            m.id === assistantMsgId ? { ...m, content: `⚠️ Error: ${error}`, isStreaming: false } : m
          ),
          isStreaming: false,
          streamingMessageId: null,
          error,
        }));
      },
    });
  },

  stopStreaming: () => {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    set((state) => ({
      isStreaming: false,
      streamingMessageId: null,
      messages: state.messages.map(m => ({ ...m, isStreaming: false })),
    }));
  },

  regenerateMessage: async () => {
    const { messages, activeCharacter, activeChat } = get();
    if (!activeCharacter || !activeChat) return;

    // Find the last assistant message and remove it
    const lastAssistantIdx = messages.findLastIndex(m => m.role === 'assistant');
    if (lastAssistantIdx === -1) return;

    // Find the last user message
    const lastUserIdx = messages.findLastIndex(m => m.role === 'user');
    if (lastUserIdx === -1) return;

    const lastUserContent = messages[lastUserIdx].content;
    const trimmedMessages = messages.slice(0, lastAssistantIdx);
    set({ messages: trimmedMessages });

    // Re-send with the last user message
    await get().sendMessage(lastUserContent);
  },

  // ---- Memory Actions ----
  loadMemories: async (characterId: string) => {
    const memories = await memoryDB.getByCharacterId(characterId);
    memories.sort((a, b) => b.importance - a.importance);
    set({ memories });
  },

  deleteMemory: async (id: string) => {
    await memoryDB.delete(id);
    const { activeCharacter } = get();
    if (activeCharacter) {
      await get().loadMemories(activeCharacter.id);
    }
  },

  // ---- UI Actions ----
  setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
  setMemoryPanelOpen: (open: boolean) => {
    set({ memoryPanelOpen: open });
    if (open) {
      const { activeCharacter } = get();
      if (activeCharacter) {
        get().loadMemories(activeCharacter.id);
      }
    }
  },
  setSettingsOpen: (open: boolean) => set({ settingsOpen: open }),
  setCharacterEditorOpen: (open: boolean, character?: Character | null) => set({
    characterEditorOpen: open,
    editingCharacter: character || null,
  }),
  clearError: () => set({ error: null }),
}));
