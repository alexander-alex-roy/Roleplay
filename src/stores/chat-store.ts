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

// ---- Types ----

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

  // UI state
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
  getNextChatNumber: (characterId: string) => Promise<number>;
  loadMessages: (chatId: string) => Promise<void>;
  selectChat: (chat: Chat) => Promise<void>;
  newChat: (character: Character) => Promise<void>;
  deleteChat: (id: string) => Promise<void>;

  // Message actions
  sendMessage: (content: string) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  stopStreaming: () => void;
  regenerateMessage: () => Promise<void>;
  addImageMessage: (imageDataUrl: string, model?: string) => Promise<void>;

  // Memory actions
  loadMemories: (chatId: string) => Promise<void>;
  deleteMemory: (id: string) => Promise<void>;

  // UI actions
  setSidebarOpen: (open: boolean) => void;
  setMemoryPanelOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setCharacterEditorOpen: (open: boolean, character?: Character | null) => void;
  clearError: () => void;
}

// ---- ID helpers ----

let msgIdCounter = 0;
function genMsgId(): string {
  msgIdCounter = (msgIdCounter + 1) % Number.MAX_SAFE_INTEGER;
  return `msg_${Date.now()}_${msgIdCounter}_${Math.random().toString(36).slice(2, 6)}`;
}

function genChatId(): string {
  return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function genCharId(): string {
  return `char_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---- Module-level abort controller ----
// FIX: Tracked at module level (not in Zustand state) so React re-renders never
// create stale closure references to an old controller instance.
let abortController: AbortController | null = null;
let currentStreamRequestId: string | null = null;
let lastSeenModelVersion = 0;

useSettingsStore.subscribe((state) => {
  if (state.modelVersion !== lastSeenModelVersion) {
    lastSeenModelVersion = state.modelVersion;
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    currentStreamRequestId = null;
  }
});

// ---- Store ----

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
    } catch (err) {
      console.error('[store] loadCharacters failed:', err);
      set({ isLoading: false });
    }
  },

  saveCharacter: async (character: Character) => {
    const { activeCharacter } = get();
    await characterDB.save(character);
    const characters = await characterDB.getAll();
    characters.sort((a, b) => b.updatedAt - a.updatedAt);
    const isActiveCharacter = activeCharacter?.id === character.id;
    set({ 
      characters,
      ...(isActiveCharacter ? { activeCharacter: character } : {}),
    });
  },

  deleteCharacter: async (id: string) => {
    const { activeCharacter } = get();

    // Delete character + all associated data in parallel where possible
    const chats = await chatDB.getByCharacterId(id);
    await Promise.all([
      ...chats.flatMap(chat => [
        messageDB.deleteByChatId(chat.id),
        chatDB.delete(chat.id),
      ]),
      memoryDB.deleteByCharacterId(id),
      characterDB.delete(id),
    ]);

    const characters = await characterDB.getAll();
    characters.sort((a, b) => b.updatedAt - a.updatedAt);

    if (activeCharacter?.id === id) {
      set({ characters, activeCharacter: null, activeChat: null, chats: [], messages: [] });
    } else {
      set({ characters });
    }
  },

  selectCharacter: async (character: Character) => {
    // FIX: The original read `messages` and `contextSummary` from state but never
    // used them — dead destructuring that could mislead readers. Removed.
    set({
      activeCharacter: character,
      messages: [],
      activeChat: null,
      contextSummary: '',
      memoryPanelOpen: false,
      memories: [],
    });
    await get().loadChats(character.id);
  },

  importCharacter: async (json: string): Promise<Character | null> => {
    try {
      const parsed = JSON.parse(json);
      let character: Character | null = null;

      // CharacterCard V2 format
      if (parsed?.spec === 'chara_card_v2' && parsed.data) {
        const d = parsed.data;
        character = {
          id: genCharId(),
          name: typeof d.name === 'string' && d.name.trim() ? d.name.trim() : 'Unnamed',
          avatar: undefined,
          description: d.description ?? '',
          personality: d.personality ?? '',
          scenario: d.scenario ?? '',
          firstMessage: d.first_mes ?? '',
          exampleMessages: d.mes_example ?? '',
          systemPrompt: d.system_prompt || undefined,
          creatorNotes: d.creator_notes ?? '',
          // FIX: Validate tags is actually an array before using it — a malformed
          // card could have tags as a string or null, causing downstream crashes.
          tags: Array.isArray(d.tags) ? d.tags.filter((t: unknown) => typeof t === 'string') : [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isFavorite: false,
          behavior: d.post_history_instructions || undefined,
        };
      } else if (parsed?.name) {
        // Direct / native format
        character = {
          id: genCharId(),
          name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : 'Unnamed',
          avatar: parsed.avatar,
          description: parsed.description ?? '',
          personality: parsed.personality ?? '',
          scenario: parsed.scenario ?? '',
          firstMessage: parsed.firstMessage ?? parsed.first_mes ?? '',
          exampleMessages: parsed.exampleMessages ?? parsed.mes_example ?? '',
          systemPrompt: parsed.systemPrompt ?? parsed.system_prompt ?? undefined,
          creatorNotes: parsed.creatorNotes ?? parsed.creator_notes ?? '',
          tags: Array.isArray(parsed.tags)
            ? parsed.tags.filter((t: unknown) => typeof t === 'string')
            : [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isFavorite: false,
          speechPatterns: parsed.speechPatterns,
          knowledge: parsed.knowledge,
          relationship: parsed.relationship,
          likes: parsed.likes,
          dislikes: parsed.dislikes,
          behavior: parsed.behavior ?? parsed.post_history_instructions,
        };
      }

      if (!character) return null;

      await characterDB.save(character);
      await get().loadCharacters();
      return character;
    } catch (err) {
      console.error('[store] importCharacter failed:', err);
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
        mes_example: character.exampleMessages ?? '',
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

  getNextChatNumber: async (characterId: string): Promise<number> => {
    const chats = await chatDB.getByCharacterId(characterId);
    let maxNum = 0;
    for (const chat of chats) {
      const match = chat.title.match(/^Chat (\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    return maxNum + 1;
  },

  loadMessages: async (chatId: string) => {
    const messages = await messageDB.getByChatId(chatId);
    messages.sort((a, b) => a.timestamp - b.timestamp);
    set({ messages });
  },

  selectChat: async (chat: Chat) => {
    set({ activeChat: chat, contextSummary: '', memories: [] });
    await get().loadMessages(chat.id);
  },

  newChat: async (character: Character) => {
    const chatNum = await get().getNextChatNumber(character.id);
    const now = Date.now();
    const chat: Chat = {
      id: genChatId(),
      characterId: character.id,
      title: `Chat ${chatNum}`,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
    };

    await chatDB.save(chat);

    const initialMessages: ChatMessage[] = [];

    if (character.firstMessage?.trim()) {
      const firstMsg: ChatMessage = {
        id: genMsgId(),
        role: 'assistant',
        content: character.firstMessage,
        timestamp: now,
        characterId: character.id,
        chatId: chat.id,
        metadata: { memoryExtracted: true },
      };
      await messageDB.save(firstMsg);
      initialMessages.push(firstMsg);

      // FIX: Mutating `chat` directly then saving it causes a reference inconsistency
      // because the same object is stored in IndexedDB and in local state. Use a new
      // object instead so each save is isolated.
      const updatedChat: Chat = { ...chat, messageCount: 1, updatedAt: Date.now() };
      await chatDB.save(updatedChat);
      set({ activeChat: updatedChat, messages: initialMessages, memories: [] });
    } else {
      set({ activeChat: chat, messages: initialMessages, memories: [] });
    }

    await get().loadChats(character.id);
  },

  deleteChat: async (id: string) => {
    const { activeChat } = get();

    // Run message, chat, and memory deletion in parallel
    await Promise.all([messageDB.deleteByChatId(id), chatDB.delete(id), memoryDB.deleteByChatId(id)]);

    if (activeChat?.id === id) {
      set({ activeChat: null, messages: [], contextSummary: '', memories: [] });
    }

    const { activeCharacter } = get();
    if (activeCharacter) {
      await get().loadChats(activeCharacter.id);
    }
  },

  // ---- Message Actions ----

  sendMessage: async (content: string) => {
    const trimmedContent = content.trim();

    // FIX: Guard early — including while already streaming — to prevent duplicate
    // in-flight requests if the user somehow triggers send twice rapidly.
    const { activeCharacter, activeChat, isStreaming } = get();
    if (!activeCharacter || !activeChat || !trimmedContent || isStreaming) return;

    const settings = useSettingsStore.getState().settings;

    // FIX: 'local' provider doesn't require an API key — align with ai-engine's logic.
    const requiresKey = settings.activeProvider !== 'local';
    const providerConfig = settings.providers.find(
      p => p.provider === settings.activeProvider && p.enabled,
    );

    if (requiresKey && (!providerConfig?.apiKey?.trim())) {
      set({
        error: `No API key configured for ${settings.activeProvider}. Please add your key in Settings (⚙️).`,
      });
      return;
    }

    // Persist user message
    const now = Date.now();
    const userMsg: ChatMessage = {
      id: genMsgId(),
      role: 'user',
      content: trimmedContent,
      timestamp: now,
      characterId: activeCharacter.id,
      chatId: activeChat.id,
    };
    await messageDB.save(userMsg);

    const allMessages = [...get().messages, userMsg];
    set({ messages: allMessages, error: null });

    // Build context window
    let apiMessages: Array<{ role: string; content: string }>;
    try {
      const result = await buildContextWindow(
        allMessages,
        activeCharacter,
        settings,
        get().contextSummary,
        activeChat.id,
      );
      set({ contextSummary: result.contextWindow.summary });
      apiMessages = result.messages;
    } catch (e) {
      set({ error: 'Failed to build context: ' + (e instanceof Error ? e.message : 'Unknown error') });
      return;
    }

    // Create streaming placeholder for assistant response
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

    // Abort any previous in-flight request (safety net — guarded by isStreaming above)
    abortController?.abort();
    abortController = new AbortController();
    const streamRequestId = `stream_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    currentStreamRequestId = streamRequestId;

    // Capture a stable reference to the current character/chat for use in callbacks,
    // which may fire after the user has navigated away and state has changed.
    const capturedCharacter = activeCharacter;
    const capturedChat = activeChat;
    let fullText = '';

    await streamChatResponse(settings, apiMessages, abortController.signal, {
      onToken: (token: string) => {
        if (currentStreamRequestId !== streamRequestId) return; // Stale response
        fullText += token;
        set(state => ({
          messages: state.messages.map(m =>
            m.id === assistantMsgId ? { ...m, content: m.content + token } : m,
          ),
        }));
      },

      onDone: async () => {
        if (currentStreamRequestId !== streamRequestId) return;
        abortController = null;
        currentStreamRequestId = null;

        const completedMsg: ChatMessage = {
          ...assistantMsg,
          content: fullText,
          isStreaming: false,
          // FIX: tokenCount was set to `fullText.length` (character count, not tokens).
          // Left as undefined here — the caller can set a real token count if the
          // provider returns usage data; a character count is worse than no count.
          tokenCount: undefined,
        };
        await messageDB.save(completedMsg);

        // FIX: Read the *current* activeChat from state inside the callback rather than
        // closing over `capturedChat`, which may have been replaced by a concurrent
        // newChat() call. However we still fall back to capturedChat for safety.
        const currentChat = get().activeChat ?? capturedChat;
        const isFirstUserMessage = currentChat.messageCount === 0;

        const updatedChat: Chat = {
          ...currentChat,
          // FIX: Increment by 2 (user + assistant) rather than 1, since both messages
          // were just persisted. The original only added 1 per turn.
          messageCount: (currentChat.messageCount ?? 0) + 2,
          updatedAt: Date.now(),
          lastMessageAt: Date.now(),
          // Auto-title the chat using the first user message (≤ 50 chars)
          title: isFirstUserMessage
            ? trimmedContent.slice(0, 50)
            : currentChat.title,
        };
        await chatDB.save(updatedChat);

        // Update the final message in state (strip isStreaming flag)
        set(state => ({
          activeChat: updatedChat,
          isStreaming: false,
          streamingMessageId: null,
          messages: state.messages.map(m =>
            m.id === assistantMsgId ? completedMsg : m,
          ),
        }));

        // Reload chat list to reflect the updated title / timestamp
        const currentCharacter = get().activeCharacter;
        if (currentCharacter) {
          await get().loadChats(currentCharacter.id);
        }

        // Extract memories in the background — never block the UI
        if (settings.memoryEnabled && settings.autoExtractMemories) {
          const existingMemories = await memoryDB.getByCharacterId(capturedCharacter.id);
          extractMemories(
            [userMsg, completedMsg],
            capturedCharacter,
            settings,
            existingMemories,
          ).catch(err => {
            console.error('[store] Memory extraction failed:', err);
          });
        }
      },

      onError: (error: string) => {
        if (currentStreamRequestId !== streamRequestId) return;
        abortController = null;
        currentStreamRequestId = null;
        // FIX: Remove the placeholder message on error rather than replacing its
        // content with an error string — that prevents a broken assistant turn from
        // being persisted to the DB or included in future context windows.
        set(state => ({
          messages: state.messages.filter(m => m.id !== assistantMsgId),
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
    currentStreamRequestId = null;
    set(state => ({
      isStreaming: false,
      streamingMessageId: null,
      // Clear the isStreaming flag on all messages (there should only ever be one,
      // but a defensive map is safer than a targeted find-and-replace)
      messages: state.messages.map(m =>
        m.isStreaming ? { ...m, isStreaming: false } : m,
      ),
    }));
  },

  deleteMessage: async (id: string) => {
    await messageDB.delete(id);
    const { messages, activeChat } = get();
    const updatedMessages = messages.filter(m => m.id !== id);
    set({ messages: updatedMessages });

    // FIX: Mutating `activeChat` directly causes stale state — spread into a new object.
    if (activeChat) {
      const updatedChat: Chat = {
        ...activeChat,
        messageCount: updatedMessages.filter(m => m.role !== 'system' && m.role !== 'memory').length,
        updatedAt: Date.now(),
      };
      await chatDB.save(updatedChat);
      set({ activeChat: updatedChat });
    }
  },

  regenerateMessage: async () => {
    const { messages, activeCharacter, activeChat, isStreaming } = get();
    if (!activeCharacter || !activeChat || isStreaming) return;

    // FIX: `findLastIndex` is ES2023 and may not be available in all target environments.
    // Use a manual reverse search for broader compatibility.
    let lastAssistantIdx = -1;
    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (lastAssistantIdx === -1 && messages[i].role === 'assistant') lastAssistantIdx = i;
      if (lastUserIdx === -1 && messages[i].role === 'user') lastUserIdx = i;
      if (lastAssistantIdx !== -1 && lastUserIdx !== -1) break;
    }

    if (lastAssistantIdx === -1 || lastUserIdx === -1) return;

    // FIX: The original deleted both messages from the DB but only trimmed up to
    // lastUserIdx in state. If the assistant message came *after* the user message
    // (the normal case), the DB delete was correct but the state slice was wrong —
    // it kept the user message in state then re-sent it, leaving a ghost user turn
    // visible in the UI. Now trim to just before the user message.
    const lastUserMsg = messages[lastUserIdx];
    const lastAssistantMsg = messages[lastAssistantIdx];

    await Promise.all([
      messageDB.delete(lastUserMsg.id),
      messageDB.delete(lastAssistantMsg.id),
    ]);

    // Keep only messages strictly before the last user message
    const trimmedMessages = messages.slice(0, lastUserIdx);
    set({ messages: trimmedMessages });

    await get().sendMessage(lastUserMsg.content);
  },

  addImageMessage: async (imageDataUrl: string, model?: string) => {
    const { activeCharacter, activeChat } = get();
    if (!activeCharacter || !activeChat) return;

    const now = Date.now();
    const imageModel = model || 'stable-diffusion-3-medium';
    const imageMsg: ChatMessage = {
      id: genMsgId(),
      role: 'assistant',
      content: '[Generated Image]',
      timestamp: now,
      characterId: activeCharacter.id,
      chatId: activeChat.id,
      metadata: { 
        image: imageDataUrl,
        model: imageModel,
        provider: 'nvidia'
      },
    };
    
    await messageDB.save(imageMsg);
    const allMessages = [...get().messages, imageMsg];
    set({ messages: allMessages });

    // Update chat message count (exclude system/memory messages)
    const updatedChat = {
      ...activeChat,
      messageCount: allMessages.filter(m => m.role !== 'system' && m.role !== 'memory').length,
      updatedAt: now,
    };
    await chatDB.save(updatedChat);
    set({ activeChat: updatedChat });
  },

  // ---- Memory Actions ----

  loadMemories: async (chatId: string) => {
    const memories = await memoryDB.getByChatId(chatId);
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
      const { activeChat } = get();
      if (activeChat) {
        get().loadMemories(activeChat.id).catch(err => {
          console.error('[store] loadMemories failed:', err);
        });
      }
    }
  },

  setSettingsOpen: (open: boolean) => set({ settingsOpen: open }),

  setCharacterEditorOpen: (open: boolean, character?: Character | null) =>
    set({ characterEditorOpen: open, editingCharacter: character ?? null }),

  clearError: () => set({ error: null }),
}));