'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useChatStore } from '@/stores/chat-store';
import { useSettingsStore } from '@/stores/settings-store';
import { getModelsForProvider, generateCharacter } from '@/lib/ai-engine';
import type { Character, AIProvider, UserPersona, CharacterTemplate } from '@/lib/types';
import { CHARACTER_TEMPLATES } from '@/lib/types';
import { exportAllData, importAllData, clearAllData } from '@/lib/db';
import {
  MessageSquare, Plus, Settings, Brain, Trash2, Star, Send, Square,
  ChevronLeft, ChevronRight, Pencil, Download, Upload, X, Bot,
  AlertCircle, RefreshCw, Search, Sparkles, Shield,
  Eye, EyeOff, Zap, BookOpen, Menu
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useContextMenuStore, ContextMenu } from '@/hooks/use-context-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { ThemeToggle } from '@/components/theme-toggle';

// ============================================================
// MAIN APP COMPONENT
// ============================================================
export default function RoleplayChat() {
  const store = useChatStore();
  const settingsStore = useSettingsStore();
  const [mounted, setMounted] = useState(false);
  const isMobile = useIsMobile();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const contextMenu = useContextMenuStore();

  // Global listeners for context menu
  useEffect(() => {
    const handleClick = () => contextMenu.hide();
    const handleScroll = () => contextMenu.hide();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') contextMenu.hide();
    };
    document.addEventListener('click', handleClick);
    document.addEventListener('scroll', handleScroll, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => {
      setMounted(true);
      store.loadCharacters();
      settingsStore.loadSettings();
    });
  }, []);

  if (!mounted) {
    return (
      <div className="h-dvh flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh flex overflow-hidden bg-background">
      {/* Character Sidebar - hidden on mobile */}
      {!isMobile && <CharacterSidebar />}

      {/* Chat History Sidebar - hidden on mobile */}
      {!isMobile && <ChatHistorySidebar />}

      {/* Mobile Nav Sheet */}
      {isMobile && (
        <MobileNavSheet open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
      )}

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {store.activeCharacter && store.activeChat ? (
          <ChatView isMobile={isMobile} onOpenMobileNav={() => setMobileNavOpen(true)} />
        ) : store.activeCharacter ? (
          <EmptyChatView isMobile={isMobile} onOpenMobileNav={() => setMobileNavOpen(true)} />
        ) : (
          <WelcomeView isMobile={isMobile} onOpenMobileNav={() => setMobileNavOpen(true)} />
        )}
      </main>

      {/* Settings Dialog */}
      <SettingsDialog />

      {/* Character Editor Dialog */}
      <CharacterEditorDialog />

      {/* Memory Panel */}
      <MemoryPanelSheet />

      {/* Setup Wizard (shown on first visit) */}
      <SetupWizard />

      {/* Global Context Menu */}
      <ContextMenu state={{ visible: contextMenu.visible, x: contextMenu.x, y: contextMenu.y, items: contextMenu.items }} menuRef={{ current: null }} />
    </div>
  );
}

// ============================================================
// SETUP WIZARD - First time setup
// ============================================================
function SetupWizard() {
  const settingsStore = useSettingsStore();
  const store = useChatStore();
  const [step, setStep] = useState(0);
  const [userName, setUserName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<CharacterTemplate | null>(null);
  const [charName, setCharName] = useState('');
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    if (settingsStore.isLoaded && settingsStore.settings.showSetupWizard) {
      setShowWizard(true);
    }
  }, [settingsStore.isLoaded, settingsStore.settings.showSetupWizard]);

  if (!showWizard || !settingsStore.isLoaded) return null;

  const handleComplete = async () => {
    if (userName.trim()) {
      await settingsStore.updateUserPersona({ name: userName.trim() });
    }
    
    if (selectedTemplate && charName.trim()) {
      const character: Character = {
        id: `char_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: charName.trim(),
        description: selectedTemplate.character.description || '',
        personality: selectedTemplate.character.personality || '',
        scenario: selectedTemplate.character.scenario || '',
        firstMessage: '',
        tags: selectedTemplate.character.tags || [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isFavorite: false,
        behavior: selectedTemplate.character.behavior,
      };
      await store.saveCharacter(character);
      await store.selectCharacter(character);
    }

    await settingsStore.dismissSetupWizard();
    setShowWizard(false);
  };

  const steps = [
    {
      title: 'Welcome!',
      description: "Let's set up your roleplay experience in just a few steps.",
    },
    {
      title: 'Your Name',
      description: "What should the AI characters call you?",
    },
    {
      title: 'Quick Start',
      description: 'Choose a template or create your own character.',
    },
  ];

  return (
    <Dialog open={showWizard} onOpenChange={() => {}}>
      <DialogContent className="max-w-lg p-0 gap-0">
        {/* Progress */}
        <div className="flex gap-1 p-4 pb-0">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        <div className="p-6 pt-4">
          <h2 className="text-xl font-bold mb-2">{steps[step].title}</h2>
          <p className="text-muted-foreground text-sm mb-6">{steps[step].description}</p>

          {step === 0 && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Shield className="w-4 h-4 text-green-500" />
                  Privacy First
                </div>
                <p className="text-xs text-muted-foreground">
                  All your data stays on your device. No servers, no tracking, no accounts.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Brain className="w-4 h-4 text-blue-500" />
                  AI-Powered
                </div>
                <p className="text-xs text-muted-foreground">
                  Bring characters to life with AI. Supports Groq (free!), OpenAI, Anthropic, and more.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  Memory
                </div>
                <p className="text-xs text-muted-foreground">
                  Characters remember your conversations and learn about you over time.
                </p>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="userName" className="text-sm">Your Name</Label>
                <Input
                  id="userName"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Enter your name..."
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Characters will use this name when talking to you.
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm">Character Template</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {CHARACTER_TEMPLATES.slice(0, -1).map((template) => (
                    <button
                      key={template.id}
                      onClick={() => setSelectedTemplate(template)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        selectedTemplate?.id === template.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="text-2xl mb-1">{template.icon}</div>
                      <div className="text-xs font-medium">{template.name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {template.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {selectedTemplate && (
                <div>
                  <Label htmlFor="charName" className="text-sm">Character Name</Label>
                  <Input
                    id="charName"
                    value={charName}
                    onChange={(e) => setCharName(e.target.value)}
                    placeholder="Enter character name..."
                    className="mt-1.5"
                  />
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-6">
            {step > 0 ? (
              <Button variant="outline" onClick={() => setStep(s => s - 1)}>
                Back
              </Button>
            ) : (
              <Button variant="outline" onClick={handleComplete}>
                Skip Setup
              </Button>
            )}
            
            {step < steps.length - 1 ? (
              <Button onClick={() => setStep(s => s + 1)}>
                Next
              </Button>
            ) : (
              <Button
                onClick={handleComplete}
                disabled={selectedTemplate ? !charName.trim() : false}
              >
                Get Started
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// WELCOME VIEW - No character selected
// ============================================================
function WelcomeView({ isMobile, onOpenMobileNav }: { isMobile: boolean; onOpenMobileNav: () => void }) {
  const store = useChatStore();
  const [importText, setImportText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = async (jsonStr?: string) => {
    const text = jsonStr || importText;
    if (!text.trim()) return;
    const character = await store.importCharacter(text);
    if (character) {
      store.selectCharacter(character);
      setImportText('');
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      handleImport(text);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Mobile top bar */}
      {isMobile && (
        <div className="h-12 border-b border-border flex items-center px-3 gap-2 bg-card flex-shrink-0">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onOpenMobileNav}>
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-semibold text-sm">RolePlay Chat</h1>
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => store.setSettingsOpen(true)}>
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      )}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto">
        <div className="max-w-lg w-full text-center space-y-6">
          <div className="space-y-2">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
              <MessageSquare className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">RolePlay Chat</h1>
            <p className="text-muted-foreground text-sm sm:text-lg">
              Private, intelligent roleplay with any AI model.
              Your data stays on your device.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:gap-4 text-center">
            <div className="p-2.5 sm:p-3 rounded-xl bg-muted/50">
              <Shield className="w-4 h-4 sm:w-5 sm:h-5 mx-auto mb-1 text-green-500" />
              <p className="text-[10px] sm:text-xs font-medium">100% Private</p>
            </div>
            <div className="p-2.5 sm:p-3 rounded-xl bg-muted/50">
              <Zap className="w-4 h-4 sm:w-5 sm:h-5 mx-auto mb-1 text-yellow-500" />
              <p className="text-[10px] sm:text-xs font-medium">BYOK Multi-Provider</p>
            </div>
            <div className="p-2.5 sm:p-3 rounded-xl bg-muted/50">
              <Brain className="w-4 h-4 sm:w-5 sm:h-5 mx-auto mb-1 text-purple-500" />
              <p className="text-[10px] sm:text-xs font-medium">Smart Memory</p>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              onClick={() => store.setCharacterEditorOpen(true)}
              className="w-full h-11 sm:h-12 text-base gap-2"
              size="lg"
            >
              <Plus className="w-5 h-5" /> Create Character
            </Button>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 gap-2 min-h-[44px]"
                onClick={() => store.setCharacterEditorOpen(true)}
              >
                <Upload className="w-4 h-4" /> Import
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.charx"
                className="hidden"
                onChange={handleFileImport}
              />
              <Button
                variant="outline"
                className="flex-1 gap-2 min-h-[44px]"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4" /> File Import
              </Button>
            </div>

            {store.characters.length > 0 && !isMobile && (
              <p className="text-sm text-muted-foreground">
                Or select a character from the sidebar →
              </p>
            )}
            {store.characters.length > 0 && isMobile && (
              <p className="text-sm text-muted-foreground">
                Or tap the menu to see your characters
              </p>
            )}
          </div>

          {!isMobile && (
            <>
              <Separator />
              <div className="flex justify-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={() => store.setSettingsOpen(true)}>
                        <Settings className="w-5 h-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Settings</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// EMPTY CHAT VIEW - Character selected, no chat started
// ============================================================
function EmptyChatView({ isMobile, onOpenMobileNav }: { isMobile: boolean; onOpenMobileNav: () => void }) {
  const store = useChatStore();
  if (!store.activeCharacter) return null;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Mobile top bar */}
      {isMobile && (
        <div className="h-12 border-b border-border flex items-center px-3 gap-2 bg-card flex-shrink-0">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onOpenMobileNav}>
            <Menu className="w-5 h-5" />
          </Button>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
            <Bot className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-sm truncate">{store.activeCharacter.name}</h2>
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => store.setSettingsOpen(true)}>
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      )}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full flex items-center justify-center mx-auto">
            <Bot className="w-10 h-10 sm:w-12 sm:h-12 text-primary" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold">{store.activeCharacter.name}</h2>
          <p className="text-muted-foreground text-sm line-clamp-3">{store.activeCharacter.description}</p>
          <Button size="lg" className="gap-2 min-h-[44px]" onClick={() => store.newChat(store.activeCharacter!)}>
            <MessageSquare className="w-5 h-5" /> Start Chat
          </Button>
          {store.chats.length > 0 && (
            <div className="pt-4 space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Recent Chats</p>
              {store.chats.slice(0, 3).map(chat => (
                <button
                  key={chat.id}
                  onClick={() => store.selectChat(chat)}
                  className="block w-full text-left px-4 py-2.5 rounded-lg hover:bg-muted text-sm truncate min-h-[44px]"
                >
                  {chat.title} <span className="text-muted-foreground text-xs">({chat.messageCount} msgs)</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CHARACTER SIDEBAR
// ============================================================
function CharacterSidebar() {
  const store = useChatStore();
  const [search, setSearch] = useState('');
  const [showFavorites, setShowFavorites] = useState(false);

  const filtered = useMemo(() => {
    let chars = store.characters;
    if (showFavorites) chars = chars.filter(c => c.isFavorite);
    if (search) chars = chars.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
    );
    return chars;
  }, [store.characters, search, showFavorites]);

  return (
    <div className={`${store.sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 border-r border-border bg-card flex flex-col overflow-hidden`}>
      <div className="p-3 space-y-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm flex items-center gap-1.5">
            <Bot className="w-4 h-4" /> Characters
          </h2>
          <div className="flex gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => store.setCharacterEditorOpen(true)}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>New Character</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => store.setSidebarOpen(false)}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Collapse</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <div className="flex gap-1">
          <Button
            variant={showFavorites ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 text-xs flex-1"
            onClick={() => setShowFavorites(!showFavorites)}
          >
            <Star className="w-3 h-3 mr-1" /> Favs
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground text-xs py-8">No characters yet</p>
          )}
          {filtered.map(char => (
            <CharacterItem key={char.id} character={char} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function CharacterItem({ character }: { character: Character }) {
  const store = useChatStore();
  const contextMenu = useContextMenuStore();
  const isActive = store.activeCharacter?.id === character.id;

  const handleContextMenu = (e: React.MouseEvent | React.TouchEvent) => {
    contextMenu.show(e, [
      {
        label: 'Chat',
        icon: <MessageSquare className="w-4 h-4" />,
        onClick: () => store.selectCharacter(character),
      },
      {
        label: 'Edit',
        icon: <Pencil className="w-4 h-4" />,
        onClick: () => store.setCharacterEditorOpen(true, character),
      },
      {
        label: character.isFavorite ? 'Unfavorite' : 'Favorite',
        icon: <Star className={`w-4 h-4 ${character.isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />,
        onClick: () => store.saveCharacter({ ...character, isFavorite: !character.isFavorite }),
      },
      { label: '', onClick: () => {}, separator: true },
      {
        label: 'Delete',
        icon: <Trash2 className="w-4 h-4" />,
        destructive: true,
        onClick: () => {
          if (confirm(`Delete "${character.name}"? This cannot be undone.`)) {
            store.deleteCharacter(character.id);
          }
        },
      },
    ]);
  };

  return (
    <div
      className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
        isActive ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
      }`}
      onClick={() => store.selectCharacter(character)}
      onContextMenu={handleContextMenu}
      onTouchEnd={(e) => {
        const now = Date.now();
        if ((e.currentTarget as HTMLElement).dataset.lastTouch === String(now - 500)) {
          handleContextMenu(e as unknown as React.TouchEvent);
        }
        (e.currentTarget as HTMLElement).dataset.lastTouch = String(now);
      }}
    >
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center flex-shrink-0">
        <Bot className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{character.name}</p>
        <p className="text-xs text-muted-foreground truncate">{character.tags.slice(0, 2).join(', ')}</p>
      </div>
      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={(e) => {
            e.stopPropagation();
            store.setCharacterEditorOpen(true, character);
          }}
        >
          <Pencil className="w-3 h-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={(e) => {
            e.stopPropagation();
            store.saveCharacter({ ...character, isFavorite: !character.isFavorite });
          }}
        >
          <Star className={`w-3 h-3 ${character.isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Delete "${character.name}"? This cannot be undone.`)) {
              store.deleteCharacter(character.id);
            }
          }}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// CHAT HISTORY SIDEBAR
// ============================================================
function ChatHistorySidebar() {
  const store = useChatStore();
  const contextMenu = useContextMenuStore();

  if (!store.activeCharacter) return null;

  return (
    <div className="w-52 border-r border-border bg-card flex flex-col overflow-hidden">
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Chats</h3>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => store.newChat(store.activeCharacter!)}
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>New Chat</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {store.chats.length === 0 && (
            <p className="text-center text-muted-foreground text-xs py-6">No chats yet</p>
          )}
          {store.chats.map(chat => {
            const handleChatContextMenu = (e: React.MouseEvent | React.TouchEvent) => {
              contextMenu.show(e, [
                {
                  label: 'Open Chat',
                  icon: <MessageSquare className="w-4 h-4" />,
                  onClick: () => store.selectChat(chat),
                },
                {
                  label: 'Delete Chat',
                  icon: <Trash2 className="w-4 h-4" />,
                  destructive: true,
                  onClick: () => {
                    if (confirm('Delete this chat?')) {
                      store.deleteChat(chat.id);
                    }
                  },
                },
              ]);
            };

            return (
              <div
                key={chat.id}
                className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors ${
                  store.activeChat?.id === chat.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                }`}
                onClick={() => store.selectChat(chat)}
                onContextMenu={handleChatContextMenu}
                onTouchEnd={(e) => {
                  const now = Date.now();
                  if ((e.currentTarget as HTMLElement).dataset.lastTouch === String(now - 500)) {
                    handleChatContextMenu(e as unknown as React.TouchEvent);
                  }
                  (e.currentTarget as HTMLElement).dataset.lastTouch = String(now);
                }}
              >
                <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate flex-1">{chat.title}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Delete this chat?')) {
                      store.deleteChat(chat.id);
                    }
                  }}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================================
// CHAT VIEW
// ============================================================
function ChatView({ isMobile, onOpenMobileNav }: { isMobile: boolean; onOpenMobileNav: () => void }) {
  const store = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [store.messages]);

  if (!store.activeCharacter || !store.activeChat) return null;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Chat Header */}
      <div className={`border-b border-border flex items-center bg-card flex-shrink-0 ${isMobile ? 'h-12 px-3 gap-2' : 'h-14 px-4 gap-3'}`}>
        {isMobile ? (
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onOpenMobileNav}>
            <Menu className="w-5 h-5" />
          </Button>
        ) : !store.sidebarOpen && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => store.setSidebarOpen(true)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        )}
        <div className={`rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center ${isMobile ? 'w-8 h-8' : 'w-8 h-8'}`}>
          <Bot className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className={`font-semibold truncate ${isMobile ? 'text-sm' : 'text-sm'}`}>{store.activeCharacter.name}</h2>
          {!isMobile && (
            <p className="text-xs text-muted-foreground truncate">{store.activeChat.title}</p>
          )}
        </div>
        <div className="flex gap-1">
          {!isMobile && (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => store.setMemoryPanelOpen(true)}>
                      <Brain className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Memory ({store.memories.length})</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => store.setCharacterEditorOpen(true, store.activeCharacter)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit Character</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => {
                      if (store.activeChat && confirm('Delete this chat?')) {
                        store.deleteChat(store.activeChat.id);
                      }
                    }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete Chat</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className={isMobile ? 'h-9 w-9' : 'h-8 w-8'} onClick={() => store.setSettingsOpen(true)}>
                  <Settings className={isMobile ? 'w-5 h-5' : 'w-4 h-4'} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Settings</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Error Banner */}
      {store.error && (
        <div className="mx-4 mt-2 px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{store.error}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={store.clearError}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className={`mx-auto p-4 space-y-4 ${isMobile ? 'max-w-full' : 'max-w-3xl'}`}>
          {store.messages.map(msg => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Chat Input */}
      <ChatInput />
    </div>
  );
}

// ============================================================
// MESSAGE BUBBLE
// ============================================================
function MessageBubble({ message }: { message: { id: string; role: string; content: string; isStreaming?: boolean; timestamp: number } }) {
  const store = useChatStore();
  const contextMenu = useContextMenuStore();
  const isUser = message.role === 'user';

  const handleContextMenu = (e: React.MouseEvent | React.TouchEvent) => {
    if (!message.content) return;
    contextMenu.show(e, [
      {
        label: 'Copy Text',
        icon: <CopyIcon className="w-4 h-4" />,
        onClick: () => navigator.clipboard.writeText(message.content),
      },
      { label: '', onClick: () => {}, separator: true },
      {
        label: 'Regenerate',
        icon: <RefreshCw className="w-4 h-4" />,
        disabled: isUser || message.isStreaming || store.messages.length < 2,
        onClick: () => store.regenerateMessage(),
      },
    ]);
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`group relative max-w-[85%] sm:max-w-[75%] ${isUser ? '' : ''}`}
        onContextMenu={handleContextMenu}
        onTouchEnd={(e) => {
          const now = Date.now();
          if ((e.currentTarget as HTMLElement).dataset.lastTouch === String(now - 500)) {
            handleContextMenu(e as unknown as React.TouchEvent);
          }
          (e.currentTarget as HTMLElement).dataset.lastTouch = String(now);
        }}
      >
        {!isUser && store.activeCharacter && (
          <div className="flex items-center gap-1.5 mb-1 ml-1">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
              <Bot className="w-3 h-3" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">{store.activeCharacter.name}</span>
          </div>
        )}
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-sm'
              : 'bg-muted rounded-tl-sm'
          }`}
        >
          {message.content}
          {message.isStreaming && <span className="animate-pulse ml-0.5">▊</span>}
        </div>
        <div className={`flex items-center gap-1 mt-1 ${isUser ? 'justify-end mr-1' : 'ml-1'}`}>
          <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {message.content && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => navigator.clipboard.writeText(message.content)}
            >
              <CopyIcon className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

// ============================================================
// CHAT INPUT
// ============================================================
function ChatInput() {
  const store = useChatStore();
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const settings = useSettingsStore(s => s.settings);

  const handleSend = useCallback(() => {
    if (!text.trim() || store.isStreaming) return;
    store.sendMessage(text);
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [text, store]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && settings.sendOnEnter) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
    }
  };

  // Focus textarea when chat loads
  useEffect(() => {
    if (store.activeChat && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [store.activeChat?.id]);

  return (
    <div className="border-t border-border bg-card p-3 safe-bottom flex-shrink-0">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={handleInput}
              placeholder={`Message ${store.activeCharacter?.name || '...'}...`}
              className="min-h-[44px] max-h-[200px] resize-none pr-12 rounded-xl text-sm"
              rows={1}
              disabled={store.isStreaming}
            />
          </div>
          {store.isStreaming ? (
            <Button
              variant="destructive"
              size="icon"
              className="h-10 w-10 rounded-xl flex-shrink-0"
              onClick={store.stopStreaming}
            >
              <Square className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              className="h-10 w-10 rounded-xl flex-shrink-0"
              onClick={handleSend}
              disabled={!text.trim()}
            >
              <Send className="w-4 h-4" />
            </Button>
          )}
        </div>
        <div className="flex items-center justify-between mt-1.5 px-1">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
              {settings.activeModel}
            </Badge>
            {store.messages.length > 0 && (
              <span>{store.messages.length} messages</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={store.regenerateMessage}
                    disabled={store.isStreaming || store.messages.length < 2}
                  >
                    <RefreshCw className="w-3 h-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Regenerate last response</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SETTINGS DIALOG
// ============================================================
function SettingsDialog() {
  const store = useChatStore();
  const settingsStore = useSettingsStore();
  const settings = settingsStore.settings;
  const [activeTab, setActiveTab] = useState<'providers' | 'model' | 'persona' | 'memory' | 'context' | 'ui' | 'data'>('providers');
  const [showKeys, setShowKeys] = useState(false);
  const [newProvider, setNewProvider] = useState<AIProvider | ''>('');
  const [newKey, setNewKey] = useState('');
  const [newBaseUrl, setNewBaseUrl] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const providers: { id: AIProvider; name: string; icon: string }[] = [
    { id: 'openai', name: 'OpenAI', icon: '🤖' },
    { id: 'anthropic', name: 'Anthropic', icon: '🧠' },
    { id: 'google', name: 'Google AI', icon: '💎' },
    { id: 'groq', name: 'Groq', icon: '⚡' },
    { id: 'mistral', name: 'Mistral', icon: '🌀' },
    { id: 'nvidia', name: 'NVIDIA NIM', icon: '🟢' },
    { id: 'openrouter', name: 'OpenRouter', icon: '🔀' },
    { id: 'local', name: 'Local LLM', icon: '💻' },
    { id: 'custom', name: 'Custom API', icon: '🔧' },
  ];

  const localPresets = [
    { id: 'ollama', name: 'Ollama', baseUrl: 'http://localhost:11434/v1', defaultModel: 'llama3.2' },
    { id: 'lmstudio', name: 'LM Studio', baseUrl: 'http://localhost:1234/v1', defaultModel: 'local-model' },
    { id: 'ollamx', name: 'OllamaX', baseUrl: 'http://localhost:3000/v1', defaultModel: 'llama3.2' },
    { id: 'llamacpp', name: 'llama.cpp', baseUrl: 'http://localhost:8080/v1', defaultModel: 'model' },
    { id: 'custom', name: 'Custom URL', baseUrl: '', defaultModel: '' },
  ];

  const [localPreset, setLocalPreset] = useState('ollama');
  const [customModelInput, setCustomModelInput] = useState('');
  const [useCustomModel, setUseCustomModel] = useState(false);

  const handleAddProvider = async () => {
    if (!newProvider || !newKey) return;
    await settingsStore.setProvider({
      provider: newProvider,
      apiKey: newKey,
      baseUrl: newBaseUrl || undefined,
      enabled: true,
    });
    // Auto-select the new provider
    await settingsStore.setActiveProvider(newProvider);
    setNewProvider('');
    setNewKey('');
    setNewBaseUrl('');
  };

  const handleExportData = async () => {
    const data = await exportAllData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roleplay-chat-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    await importAllData(text);
    store.loadCharacters();
    settingsStore.loadSettings();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClearData = async () => {
    if (confirm('Are you sure? This will delete ALL characters, chats, messages, and memories permanently.')) {
      await clearAllData();
      store.loadCharacters();
      settingsStore.loadSettings();
    }
  };

  const models = getModelsForProvider(settings.activeProvider);

  const tabs = [
    { id: 'providers' as const, label: 'API Keys', icon: <Key className="w-4 h-4" /> },
    { id: 'model' as const, label: 'Model', icon: <Zap className="w-4 h-4" /> },
    { id: 'persona' as const, label: 'Your Profile', icon: <Bot className="w-4 h-4" /> },
    { id: 'memory' as const, label: 'Memory', icon: <Brain className="w-4 h-4" /> },
    { id: 'context' as const, label: 'Context', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'ui' as const, label: 'UI', icon: <Eye className="w-4 h-4" /> },
    { id: 'data' as const, label: 'Data', icon: <Download className="w-4 h-4" /> },
  ];

  return (
    <Dialog open={store.settingsOpen} onOpenChange={store.setSettingsOpen}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" /> Settings
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col sm:flex-row">
          {/* Tab navigation */}
          <div className="sm:w-40 border-r border-border p-2 flex sm:flex-col gap-1 overflow-x-auto sm:overflow-x-visible flex-shrink-0">
            {tabs.map(tab => (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? 'secondary' : 'ghost'}
                size="sm"
                className="justify-start gap-2 text-xs whitespace-nowrap h-8"
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon} {tab.label}
              </Button>
            ))}
          </div>

          {/* Tab content */}
          <ScrollArea className="flex-1 p-4">
            {activeTab === 'providers' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm">API Keys (BYOK)</h3>
                    <p className="text-xs text-muted-foreground">Keys stored locally on your device only</p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        setTesting(true);
                        setTestResult(null);
                        const result = await settingsStore.testConnection();
                        setTestResult(result);
                        setTesting(false);
                      }}
                      disabled={testing}
                      className="gap-1"
                    >
                      {testing ? (
                        <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Zap className="w-3 h-3" />
                      )}
                      Test
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowKeys(!showKeys)} className="gap-1">
                      {showKeys ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      {showKeys ? 'Hide' : 'Show'}
                    </Button>
                  </div>
                </div>

                {/* Test result banner */}
                {testResult && (
                  <div className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
                    testResult.success
                      ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20'
                      : 'bg-destructive/10 text-destructive border border-destructive/20'
                  }`}>
                    {testResult.success ? (
                      <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5-5 5"/><path d="M20 6H9"/></svg>
                    ) : (
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span className="flex-1">{testResult.message}</span>
                  </div>
                )}

                {/* Configured providers */}
                <div className="space-y-2">
                  {settings.providers.map(p => (
                    <div key={p.provider} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                      <span className="text-lg flex-shrink-0">
                        {providers.find(pr => pr.id === p.provider)?.icon || '🔑'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{providers.find(pr => pr.id === p.provider)?.name || p.provider}</p>
                        <p 
                          className="text-xs text-muted-foreground font-mono truncate" 
                          title={showKeys ? p.apiKey : `••••${p.apiKey.slice(-4)}`}
                        >
                          {showKeys 
                            ? `${p.apiKey.slice(0, 8)}...${p.apiKey.slice(-4)}` 
                            : '•'.repeat(Math.min(p.apiKey.length, 16))
                          }
                        </p>
                      </div>
                      <Button
                        variant={settings.activeProvider === p.provider ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 text-xs shrink-0"
                        onClick={() => settingsStore.setActiveProvider(p.provider)}
                      >
                        {settings.activeProvider === p.provider ? 'Active' : 'Select'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => settingsStore.removeProvider(p.provider)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Add new provider */}
                <Separator />
                <div className="space-y-2">
                  <p className="text-sm font-medium">Add Provider</p>
                  <Select value={newProvider} onValueChange={(v) => setNewProvider(v as AIProvider)}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select provider..." />
                    </SelectTrigger>
                    <SelectContent>
                      {providers.filter(p => !settings.providers.some(sp => sp.provider === p.id)).map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.icon} {p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {/* Local LLM specific options */}
                  {newProvider === 'local' && (
                    <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs font-medium text-muted-foreground">Local LLM Settings</p>
                      <Select value={localPreset} onValueChange={(v) => {
                        setLocalPreset(v);
                        const preset = localPresets.find(p => p.id === v);
                        if (preset && preset.id !== 'custom') {
                          setNewBaseUrl(preset.baseUrl);
                          settingsStore.setActiveModel(preset.defaultModel);
                        } else {
                          setNewBaseUrl('');
                        }
                      }}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Select preset..." />
                        </SelectTrigger>
                        <SelectContent>
                          {localPresets.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Base URL (e.g., http://localhost:11434/v1)"
                        value={newBaseUrl}
                        onChange={(e) => setNewBaseUrl(e.target.value)}
                        className="h-9 text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Make sure your local LLM server is running before testing.
                      </p>
                    </div>
                  )}
                  
                  {/* API Key for cloud providers */}
                  {newProvider && newProvider !== 'local' && (
                    <Input
                      type={showKeys ? 'text' : 'password'}
                      placeholder="API Key"
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                      className="h-9 text-sm"
                    />
                  )}
                  
                  {/* Base URL for custom provider */}
                  {newProvider === 'custom' && (
                    <Input
                      placeholder="Custom Base URL (optional)"
                      value={newBaseUrl}
                      onChange={(e) => setNewBaseUrl(e.target.value)}
                      className="h-9 text-sm"
                    />
                  )}
                  
                  <Button 
                    size="sm" 
                    onClick={handleAddProvider} 
                    disabled={!newProvider || (newProvider !== 'local' && !newKey)} 
                    className="gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Provider
                  </Button>
                </div>
              </div>
            )}

            {activeTab === 'model' && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-sm">Model Selection</h3>
                  <p className="text-xs text-muted-foreground">Choose the AI model for roleplay</p>
                </div>
                
                {/* Custom model toggle */}
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="useCustomModel" 
                    checked={useCustomModel} 
                    onCheckedChange={(checked) => {
                      setUseCustomModel(checked === true);
                      if (checked !== true) {
                        setCustomModelInput('');
                      }
                    }} 
                  />
                  <Label htmlFor="useCustomModel" className="text-sm cursor-pointer">
                    Enter custom model ID
                  </Label>
                </div>
                
                {useCustomModel ? (
                  <div className="space-y-2">
                    <Input
                      placeholder="Enter custom model ID (e.g., gpt-4o, claude-3-5-sonnet)"
                      value={customModelInput}
                      onChange={(e) => {
                        setCustomModelInput(e.target.value);
                        if (e.target.value.trim()) {
                          settingsStore.setActiveModel(e.target.value.trim());
                        }
                      }}
                      className="text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter the exact model ID your API provider expects
                    </p>
                  </div>
                ) : (
                  <Select value={settings.activeModel} onValueChange={(v) => settingsStore.setActiveModel(v)}>
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                          <span className="text-muted-foreground ml-2 text-xs">
                            ({(m.maxContextTokens / 1000).toFixed(0)}k ctx)
                          </span>
                        </SelectItem>
                      ))}
                      {models.length === 0 && (
                        <SelectItem value="_none" disabled>No models available - enable custom model above</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                )}

                <Separator />
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Generation Parameters</h4>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <Label>Temperature: {settings.temperature.toFixed(2)}</Label>
                      <span className="text-muted-foreground">Higher = more creative</span>
                    </div>
                    <Slider
                      value={[settings.temperature]}
                      min={0} max={2} step={0.05}
                      onValueChange={([v]) => settingsStore.updateSetting('temperature', v)}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <Label>Max Tokens: {settings.maxTokens}</Label>
                      <span className="text-muted-foreground">Max response length</span>
                    </div>
                    <Slider
                      value={[settings.maxTokens]}
                      min={64} max={4096} step={64}
                      onValueChange={([v]) => settingsStore.updateSetting('maxTokens', v)}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <Label>Top P: {settings.topP.toFixed(2)}</Label>
                    </div>
                    <Slider
                      value={[settings.topP]}
                      min={0} max={1} step={0.05}
                      onValueChange={([v]) => settingsStore.updateSetting('topP', v)}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <Label>Frequency Penalty: {settings.frequencyPenalty.toFixed(2)}</Label>
                      <span className="text-muted-foreground">Reduce repetition</span>
                    </div>
                    <Slider
                      value={[settings.frequencyPenalty]}
                      min={0} max={2} step={0.1}
                      onValueChange={([v]) => settingsStore.updateSetting('frequencyPenalty', v)}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <Label>Presence Penalty: {settings.presencePenalty.toFixed(2)}</Label>
                      <span className="text-muted-foreground">Encourage new topics</span>
                    </div>
                    <Slider
                      value={[settings.presencePenalty]}
                      min={0} max={2} step={0.1}
                      onValueChange={([v]) => settingsStore.updateSetting('presencePenalty', v)}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'persona' && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-sm">Your Profile</h3>
                  <p className="text-xs text-muted-foreground">Define who you are in roleplay conversations</p>
                </div>

                <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Bot className="w-4 h-4" />
                    This is Optional
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Characters will use this information to address you and understand your role in the story.
                  </p>
                </div>

                <div>
                  <Label className="text-sm">Your Name</Label>
                  <Input
                    value={settings.userPersona.name}
                    onChange={(e) => settingsStore.updateUserPersona({ name: e.target.value })}
                    placeholder="How characters should call you..."
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-sm">Your Description</Label>
                  <Textarea
                    value={settings.userPersona.description}
                    onChange={(e) => settingsStore.updateUserPersona({ description: e.target.value })}
                    placeholder="Your appearance, background, who you are in the story..."
                    className="mt-1 min-h-[80px]"
                  />
                </div>

                <div>
                  <Label className="text-sm">Your Personality</Label>
                  <Textarea
                    value={settings.userPersona.personality || ''}
                    onChange={(e) => settingsStore.updateUserPersona({ personality: e.target.value })}
                    placeholder="Your traits, behavior patterns, communication style..."
                    className="mt-1 min-h-[60px]"
                  />
                </div>

                <div>
                  <Label className="text-sm">Your Speech Style</Label>
                  <Textarea
                    value={settings.userPersona.speechPatterns || ''}
                    onChange={(e) => settingsStore.updateUserPersona({ speechPatterns: e.target.value })}
                    placeholder="How you typically speak - formal, casual, uses certain phrases..."
                    className="mt-1 min-h-[60px]"
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Remember My Profile</Label>
                    <p className="text-xs text-muted-foreground">Include profile in system prompt</p>
                  </div>
                  <Switch
                    checked={!!settings.userPersona.name}
                    onCheckedChange={(v) => {
                      if (!v) {
                        settingsStore.updateUserPersona({ name: '', description: '', personality: '', speechPatterns: '' });
                      }
                    }}
                  />
                </div>
              </div>
            )}

            {activeTab === 'memory' && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-sm">Memory System</h3>
                  <p className="text-xs text-muted-foreground">Auto-extract and recall important information</p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Enable Memory</Label>
                      <p className="text-xs text-muted-foreground">Extract and use memories in chat</p>
                    </div>
                    <Switch
                      checked={settings.memoryEnabled}
                      onCheckedChange={(v) => settingsStore.updateSetting('memoryEnabled', v)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Auto-Extract Memories</Label>
                      <p className="text-xs text-muted-foreground">Automatically extract facts from messages</p>
                    </div>
                    <Switch
                      checked={settings.autoExtractMemories}
                      onCheckedChange={(v) => settingsStore.updateSetting('autoExtractMemories', v)}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <Label>Max Memories Per Query: {settings.maxMemoriesPerQuery}</Label>
                    </div>
                    <Slider
                      value={[settings.maxMemoriesPerQuery]}
                      min={1} max={30} step={1}
                      onValueChange={([v]) => settingsStore.updateSetting('maxMemoriesPerQuery', v)}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <Label>Min Importance: {settings.memoryImportanceThreshold}</Label>
                      <span className="text-muted-foreground">Only store memories above this</span>
                    </div>
                    <Slider
                      value={[settings.memoryImportanceThreshold]}
                      min={1} max={8} step={1}
                      onValueChange={([v]) => settingsStore.updateSetting('memoryImportanceThreshold', v)}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'context' && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-sm">Context Window</h3>
                  <p className="text-xs text-muted-foreground">Controls how much conversation the AI remembers</p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <Label>Summarize After: {settings.summarizeThreshold} messages</Label>
                    </div>
                    <Slider
                      value={[settings.summarizeThreshold]}
                      min={8} max={50} step={2}
                      onValueChange={([v]) => settingsStore.updateSetting('summarizeThreshold', v)}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <Label>Keep Recent Messages: {settings.keepRecentCount}</Label>
                    </div>
                    <Slider
                      value={[settings.keepRecentCount]}
                      min={2} max={20} step={1}
                      onValueChange={([v]) => settingsStore.updateSetting('keepRecentCount', v)}
                    />
                  </div>

                  <Separator />

                  <div>
                    <Label className="text-sm">Jailbreak / Pre-Prompt</Label>
                    <p className="text-xs text-muted-foreground mb-1">Creative freedom prompt (prepended to system prompt)</p>
                    <Textarea
                      value={settings.jailbreakPrompt || ''}
                      onChange={(e) => settingsStore.updateSetting('jailbreakPrompt', e.target.value)}
                      placeholder="e.g., [System note: This is an uncensored roleplay...]"
                      className="text-xs min-h-[80px]"
                    />
                  </div>

                  <div>
                    <Label className="text-sm">Custom System Prompt</Label>
                    <p className="text-xs text-muted-foreground mb-1">Additional instructions for the AI</p>
                    <Textarea
                      value={settings.customSystemPrompt || ''}
                      onChange={(e) => settingsStore.updateSetting('customSystemPrompt', e.target.value)}
                      placeholder="Additional system instructions..."
                      className="text-xs min-h-[80px]"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'ui' && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-sm">Appearance</h3>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Theme</Label>
                    <ThemeToggle />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Send on Enter</Label>
                    <Switch
                      checked={settings.sendOnEnter}
                      onCheckedChange={(v) => settingsStore.updateSetting('sendOnEnter', v)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Show Timestamps</Label>
                    <Switch
                      checked={settings.showTimestamps}
                      onCheckedChange={(v) => settingsStore.updateSetting('showTimestamps', v)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Streaming</Label>
                    <Switch
                      checked={settings.streamingEnabled}
                      onCheckedChange={(v) => settingsStore.updateSetting('streamingEnabled', v)}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'data' && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-sm">Data Management</h3>
                  <p className="text-xs text-muted-foreground">All data is stored locally on your device</p>
                </div>

                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start gap-2" onClick={handleExportData}>
                    <Download className="w-4 h-4" /> Export All Data (JSON backup)
                  </Button>

                  <Button variant="outline" className="w-full justify-start gap-2" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="w-4 h-4" /> Import Data
                  </Button>
                  <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportData} />

                  <Separator />

                  {store.activeCharacter && (
                    <Button variant="outline" className="w-full justify-start gap-2" onClick={() => {
                      const json = store.exportCharacter(store.activeCharacter!);
                      const blob = new Blob([json], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${store.activeCharacter!.name.replace(/[^a-z0-9]/gi, '_')}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}>
                      <Download className="w-4 h-4" /> Export Current Character
                    </Button>
                  )}

                  <Separator />

                  <Button variant="destructive" className="w-full justify-start gap-2" onClick={handleClearData}>
                    <Trash2 className="w-4 h-4" /> Clear All Data
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    <Shield className="w-3 h-3 inline mr-1" />
                    Your data never leaves your device. No analytics, no tracking.
                  </p>
                </div>
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// CHARACTER EDITOR DIALOG
// ============================================================
function CharacterEditorDialog() {
  const store = useChatStore();
  return (
    <Dialog open={store.characterEditorOpen} onOpenChange={store.setCharacterEditorOpen}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
        <CharacterEditorInner key={store.editingCharacter?.id || 'new'} />
      </DialogContent>
    </Dialog>
  );
}

function CharacterEditorInner() {
  const store = useChatStore();
  const settingsStore = useSettingsStore();
  const initialCharacter = store.editingCharacter;
  const isEditing = !!initialCharacter;

  const [form, setForm] = useState<Partial<Character>>(() => ({
    name: initialCharacter?.name || '',
    avatar: initialCharacter?.avatar || '',
    description: initialCharacter?.description || '',
    personality: initialCharacter?.personality || '',
    scenario: initialCharacter?.scenario || '',
    firstMessage: initialCharacter?.firstMessage || '',
    exampleMessages: initialCharacter?.exampleMessages || '',
    systemPrompt: initialCharacter?.systemPrompt || '',
    creatorNotes: initialCharacter?.creatorNotes || '',
    tags: initialCharacter?.tags || [],
    speechPatterns: initialCharacter?.speechPatterns || '',
    knowledge: initialCharacter?.knowledge || '',
    relationship: initialCharacter?.relationship || '',
    likes: initialCharacter?.likes || '',
    dislikes: initialCharacter?.dislikes || '',
    behavior: initialCharacter?.behavior || '',
  }));

  const [tagInput, setTagInput] = useState('');

  const handleSave = () => {
    const character: Character = {
      id: store.editingCharacter?.id || `char_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: form.name || 'Unnamed',
      avatar: form.avatar || undefined,
      description: form.description || '',
      personality: form.personality || '',
      scenario: form.scenario || '',
      firstMessage: form.firstMessage || '',
      exampleMessages: form.exampleMessages || '',
      systemPrompt: form.systemPrompt || undefined,
      creatorNotes: form.creatorNotes || '',
      tags: form.tags || [],
      createdAt: store.editingCharacter?.createdAt || Date.now(),
      updatedAt: Date.now(),
      isFavorite: store.editingCharacter?.isFavorite || false,
      speechPatterns: form.speechPatterns || undefined,
      knowledge: form.knowledge || undefined,
      relationship: form.relationship || undefined,
      likes: form.likes || undefined,
      dislikes: form.dislikes || undefined,
      behavior: form.behavior || undefined,
    };

    store.saveCharacter(character);
    store.setCharacterEditorOpen(false);
    if (!isEditing) {
      store.selectCharacter(character);
    }
  };

  const addTag = () => {
    if (!tagInput.trim()) return;
    setForm(f => ({ ...f, tags: [...(f.tags || []), tagInput.trim()] }));
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setForm(f => ({ ...f, tags: (f.tags || []).filter(t => t !== tag) }));
  };

  const [activeField, setActiveField] = useState(isEditing ? 'identity' : 'templates');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generationPrompt, setGenerationPrompt] = useState('');
  const [generationError, setGenerationError] = useState<string | null>(null);

  const handleGenerateCharacter = async () => {
    setGenerating(true);
    setGenerationError(null);
    try {
      const generated = await generateCharacter(settingsStore.settings, {
        userPrompt: generationPrompt,
      });
      if (generated) {
        setForm(f => ({
          ...f,
          name: generated.name,
          description: generated.description,
          personality: generated.personality,
          scenario: generated.scenario,
          firstMessage: generated.firstMessage,
          speechPatterns: generated.speechPatterns,
          likes: generated.likes,
          dislikes: generated.dislikes,
          behavior: generated.behavior,
          tags: generated.tags,
        }));
        setSelectedTemplate('ai-generated');
        setGenerationPrompt('');
      }
    } catch (e) {
      setGenerationError(e instanceof Error ? e.message : 'Failed to generate character');
    } finally {
      setGenerating(false);
    }
  };

  const fields = [
    { id: 'templates', label: 'Templates', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'identity', label: 'Identity', icon: <Bot className="w-4 h-4" /> },
    { id: 'personality', label: 'Personality', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'scenario', label: 'Scenario', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'advanced', label: 'Advanced', icon: <Settings className="w-4 h-4" /> },
  ];

  const applyTemplate = (template: CharacterTemplate) => {
    if (!template.character) return;
    setSelectedTemplate(template.id);
    setForm(f => ({
      ...f,
      ...template.character,
      tags: template.character.tags || f.tags,
    }));
  };

  return (
    <>
      <DialogHeader className="px-6 pt-6 pb-0">
        <DialogTitle>{isEditing ? 'Edit Character' : 'Create Character'}</DialogTitle>
      </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col sm:flex-row">
          {/* Field tabs */}
          <div className="sm:w-36 border-r border-border p-2 flex sm:flex-col gap-1 overflow-x-auto sm:overflow-x-visible flex-shrink-0">
            {fields.map(f => (
              <Button
                key={f.id}
                variant={activeField === f.id ? 'secondary' : 'ghost'}
                size="sm"
                className="justify-start gap-2 text-xs whitespace-nowrap h-8"
                onClick={() => setActiveField(f.id)}
              >
                {f.icon} {f.label}
              </Button>
            ))}
          </div>

          {/* Form */}
          <ScrollArea className="flex-1 p-4">
            {activeField === 'templates' && !isEditing && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-sm">Create Your Character</h3>
                  <p className="text-xs text-muted-foreground">Choose a template or let AI generate one</p>
                </div>

                {/* AI Generate Section */}
                <div className="p-4 rounded-lg border border-dashed border-primary/30 bg-primary/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">AI Generate</span>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleGenerateCharacter}
                      disabled={generating}
                      className="gap-1"
                    >
                      {generating ? (
                        <>
                          <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3" />
                          Generate
                        </>
                      )}
                    </Button>
                  </div>
                  <Input
                    value={generationPrompt}
                    onChange={(e) => setGenerationPrompt(e.target.value)}
                    placeholder="Describe the character you want (optional)"
                    className="h-8 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !generating) {
                        handleGenerateCharacter();
                      }
                    }}
                  />
                  {generationError && (
                    <p className="text-xs text-destructive">{generationError}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    Describe a character concept and AI will create a full character card.
                  </p>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">or choose a template</span>
                  </div>
                </div>

                {/* Templates Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {CHARACTER_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => applyTemplate(template)}
                      className={`p-4 rounded-lg border text-left transition-all hover:border-primary/50 ${
                        selectedTemplate === template.id
                          ? 'border-primary bg-primary/10 ring-1 ring-primary'
                          : 'border-border'
                      }`}
                    >
                      <div className="text-3xl mb-2">{template.icon}</div>
                      <div className="text-sm font-medium">{template.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {template.description}
                      </div>
                      {template.character.tags && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {template.character.tags.slice(0, 3).map(tag => (
                            <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeField === 'templates' && isEditing && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-sm">AI Generate</h3>
                  <p className="text-xs text-muted-foreground">Let AI create a character for you</p>
                </div>

                <div className="p-4 rounded-lg border border-dashed border-primary/30 bg-primary/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">Generate with AI</span>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleGenerateCharacter}
                      disabled={generating}
                      className="gap-1"
                    >
                      {generating ? (
                        <>
                          <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3" />
                          Generate
                        </>
                      )}
                    </Button>
                  </div>
                  <Input
                    value={generationPrompt}
                    onChange={(e) => setGenerationPrompt(e.target.value)}
                    placeholder="Describe the character you want (optional)"
                    className="h-8 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !generating) {
                        handleGenerateCharacter();
                      }
                    }}
                  />
                  {generationError && (
                    <p className="text-xs text-destructive">{generationError}</p>
                  )}
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">or use a template</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {CHARACTER_TEMPLATES.slice(0, -1).map((template) => (
                    <button
                      key={template.id}
                      onClick={() => {
                        if (confirm('This will replace your current character. Continue?')) {
                          applyTemplate(template);
                        }
                      }}
                      className="p-4 rounded-lg border border-border text-left transition-all hover:border-primary/50"
                    >
                      <div className="text-3xl mb-2">{template.icon}</div>
                      <div className="text-sm font-medium">{template.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {template.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeField === 'identity' && (
              <div className="space-y-3">
                <div>
                  <Label className="text-sm">Name *</Label>
                  <Input
                    value={form.name || ''}
                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Character name"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm">Avatar URL</Label>
                  <Input
                    value={form.avatar || ''}
                    onChange={(e) => setForm(f => ({ ...f, avatar: e.target.value }))}
                    placeholder="https://..."
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm">Description *</Label>
                  <p className="text-xs text-muted-foreground mb-1">Physical appearance, background, who they are</p>
                  <Textarea
                    value={form.description || ''}
                    onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="A young woman with long silver hair and piercing blue eyes. She is a wandering mage..."
                    className="min-h-[120px]"
                  />
                </div>
                <div>
                  <Label className="text-sm">Tags</Label>
                  <div className="flex flex-wrap gap-1 mt-1 mb-1">
                    {(form.tags || []).map(tag => (
                      <Badge key={tag} variant="secondary" className="gap-1">
                        {tag}
                        <button onClick={() => removeTag(tag)} className="hover:text-destructive">
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addTag()}
                      placeholder="Add tag..."
                      className="h-8 text-sm"
                    />
                    <Button variant="outline" size="sm" onClick={addTag}>
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {activeField === 'personality' && (
              <div className="space-y-3">
                <div>
                  <Label className="text-sm">Personality *</Label>
                  <p className="text-xs text-muted-foreground mb-1">Core traits, mannerisms, quirks</p>
                  <Textarea
                    value={form.personality || ''}
                    onChange={(e) => setForm(f => ({ ...f, personality: e.target.value }))}
                    placeholder="Kind but reserved, slow to trust. Has a dry sense of humor..."
                    className="min-h-[100px]"
                  />
                </div>
                <div>
                  <Label className="text-sm">Speech Patterns</Label>
                  <p className="text-xs text-muted-foreground mb-1">How they talk (accent, vocabulary, verbal habits)</p>
                  <Textarea
                    value={form.speechPatterns || ''}
                    onChange={(e) => setForm(f => ({ ...f, speechPatterns: e.target.value }))}
                    placeholder="Speaks formally, occasionally uses archaic phrases..."
                    className="min-h-[80px]"
                  />
                </div>
                <div>
                  <Label className="text-sm">Likes</Label>
                  <Textarea
                    value={form.likes || ''}
                    onChange={(e) => setForm(f => ({ ...f, likes: e.target.value }))}
                    placeholder="Things they enjoy"
                    className="min-h-[60px]"
                  />
                </div>
                <div>
                  <Label className="text-sm">Dislikes</Label>
                  <Textarea
                    value={form.dislikes || ''}
                    onChange={(e) => setForm(f => ({ ...f, dislikes: e.target.value }))}
                    placeholder="Things they hate"
                    className="min-h-[60px]"
                  />
                </div>
              </div>
            )}

            {activeField === 'scenario' && (
              <div className="space-y-3">
                <div>
                  <Label className="text-sm">Scenario / Setting</Label>
                  <p className="text-xs text-muted-foreground mb-1">The world, situation, or starting context</p>
                  <Textarea
                    value={form.scenario || ''}
                    onChange={(e) => setForm(f => ({ ...f, scenario: e.target.value }))}
                    placeholder="A medieval fantasy world where magic is dying. The character runs a small bookshop..."
                    className="min-h-[100px]"
                  />
                </div>
                <div>
                  <Label className="text-sm">Relationship to User</Label>
                  <Textarea
                    value={form.relationship || ''}
                    onChange={(e) => setForm(f => ({ ...f, relationship: e.target.value }))}
                    placeholder="Strangers who just met at a tavern..."
                    className="min-h-[60px]"
                  />
                </div>
                <div>
                  <Label className="text-sm">First Message *</Label>
                  <p className="text-xs text-muted-foreground mb-1">The character's opening greeting</p>
                  <Textarea
                    value={form.firstMessage || ''}
                    onChange={(e) => setForm(f => ({ ...f, firstMessage: e.target.value }))}
                    placeholder="*The bell above the door chimes as you enter the bookshop* Oh, hello there..."
                    className="min-h-[120px]"
                  />
                </div>
                <div>
                  <Label className="text-sm">Example Dialogue</Label>
                  <p className="text-xs text-muted-foreground mb-1">Example messages (Character.ai format: &lt;START&gt;)</p>
                  <Textarea
                    value={form.exampleMessages || ''}
                    onChange={(e) => setForm(f => ({ ...f, exampleMessages: e.target.value }))}
                    placeholder={`<START>\n{{user}}: Hello!\n{{char}}: *smiles warmly* Welcome, traveler.`}
                    className="min-h-[120px] font-mono text-xs"
                  />
                </div>
              </div>
            )}

            {activeField === 'advanced' && (
              <div className="space-y-3">
                <div>
                  <Label className="text-sm">Knowledge</Label>
                  <p className="text-xs text-muted-foreground mb-1">What the character knows (skills, history, secrets)</p>
                  <Textarea
                    value={form.knowledge || ''}
                    onChange={(e) => setForm(f => ({ ...f, knowledge: e.target.value }))}
                    placeholder="Knows ancient elvish, skilled in potion-making..."
                    className="min-h-[80px]"
                  />
                </div>
                <div>
                  <Label className="text-sm">Behavioral Guidelines</Label>
                  <p className="text-xs text-muted-foreground mb-1">How the character should behave in the roleplay</p>
                  <Textarea
                    value={form.behavior || ''}
                    onChange={(e) => setForm(f => ({ ...f, behavior: e.target.value }))}
                    placeholder="Always maintain mystery. Never reveal full backstory at once..."
                    className="min-h-[80px]"
                  />
                </div>
                <div>
                  <Label className="text-sm">Custom System Prompt (Override)</Label>
                  <p className="text-xs text-muted-foreground mb-1">Replaces auto-generated system prompt entirely</p>
                  <Textarea
                    value={form.systemPrompt || ''}
                    onChange={(e) => setForm(f => ({ ...f, systemPrompt: e.target.value }))}
                    placeholder="Write {{char}}'s entire system prompt here..."
                    className="min-h-[120px]"
                  />
                </div>
                <div>
                  <Label className="text-sm">Creator Notes</Label>
                  <Textarea
                    value={form.creatorNotes || ''}
                    onChange={(e) => setForm(f => ({ ...f, creatorNotes: e.target.value }))}
                    placeholder="Private notes about this character..."
                    className="min-h-[60px]"
                  />
                </div>
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border flex justify-end gap-2">
          {isEditing && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (confirm('Delete this character?')) {
                  store.deleteCharacter(store.editingCharacter!.id);
                  store.setCharacterEditorOpen(false);
                }
              }}
            >
              Delete
            </Button>
          )}
          <Button variant="outline" onClick={() => store.setCharacterEditorOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!form.name?.trim()}>
            {isEditing ? 'Save Changes' : 'Create Character'}
          </Button>
        </div>
    </>
  );
}

// ============================================================
// MOBILE NAV SHEET
// ============================================================
function MobileNavSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const store = useChatStore();
  const [search, setSearch] = useState('');
  const [showFavorites, setShowFavorites] = useState(false);

  const filtered = useMemo(() => {
    let chars = store.characters;
    if (showFavorites) chars = chars.filter(c => c.isFavorite);
    if (search) chars = chars.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
    );
    return chars;
  }, [store.characters, search, showFavorites]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[300px] max-w-[85vw] p-0">
        <SheetHeader className="p-4 pb-3 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" /> RolePlay Chat
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100dvh-10rem)]">
          {/* Characters Section */}
          <div className="border-b border-border">
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-1.5">
                  <Bot className="w-4 h-4" /> Characters
                </h3>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { store.setCharacterEditorOpen(true); onOpenChange(false); }}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
              </div>
              <div className="flex gap-1">
                <Button
                  variant={showFavorites ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-8 text-xs flex-1"
                  onClick={() => setShowFavorites(!showFavorites)}
                >
                  <Star className="w-3 h-3 mr-1" /> Favorites
                </Button>
              </div>
            </div>
            <div className="px-2 pb-2 space-y-1">
              {filtered.length === 0 && (
                <p className="text-center text-muted-foreground text-xs py-4">No characters yet</p>
              )}
              {filtered.map(char => (
                <div
                  key={char.id}
                  className={`flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer transition-colors ${
                    store.activeCharacter?.id === char.id ? 'bg-primary/10 text-primary' : 'active:bg-muted'
                  }`}
                  onClick={() => { store.selectCharacter(char); onOpenChange(false); }}
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{char.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{char.tags.slice(0, 2).join(', ') || 'No tags'}</p>
                  </div>
                  {char.isFavorite && (
                    <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Chat History Section */}
          {store.activeCharacter && (
            <div>
              <div className="p-3 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-semibold">Chats with {store.activeCharacter.name}</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => { store.newChat(store.activeCharacter!); onOpenChange(false); }}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="p-2 space-y-0.5">
                {store.chats.length === 0 && (
                  <p className="text-center text-muted-foreground text-xs py-4">No chats yet</p>
                )}
                {store.chats.map(chat => (
                  <div
                    key={chat.id}
                    className={`flex items-center gap-1.5 px-2.5 py-2.5 rounded-lg cursor-pointer text-sm transition-colors ${
                      store.activeChat?.id === chat.id ? 'bg-primary/10 text-primary' : 'active:bg-muted'
                    }`}
                    onClick={() => { store.selectChat(chat); onOpenChange(false); }}
                  >
                    <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate flex-1">{chat.title}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        store.deleteChat(chat.id);
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ScrollArea>

        {/* Bottom actions */}
        <div className="p-3 border-t border-border space-y-1">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 min-h-[44px]"
            onClick={() => { store.setSettingsOpen(true); onOpenChange(false); }}
          >
            <Settings className="w-4 h-4" /> Settings
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ============================================================
// MEMORY PANEL (Sheet)
// ============================================================
function MemoryPanelSheet() {
  const store = useChatStore();

  const getMemoryTypeColor = (type: string) => {
    switch (type) {
      case 'fact': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'event': return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
      case 'emotion': return 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20';
      case 'preference': return 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20';
      case 'instruction': return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20';
      default: return 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20';
    }
  };

  const formatRelativeTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
  };

  const memoriesByType = store.memories.reduce((acc, mem) => {
    acc[mem.type] = (acc[mem.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Sheet open={store.memoryPanelOpen} onOpenChange={store.setMemoryPanelOpen}>
      <SheetContent className="w-80 sm:w-96 flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5" /> Memory
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Memory Stats */}
          {store.memories.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                <p className="text-2xl font-bold">{store.memories.length}</p>
                <p className="text-xs text-muted-foreground">Total Memories</p>
              </div>
              <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/10">
                <p className="text-2xl font-bold">
                  {store.memories.filter(m => m.accessCount > 2).length}
                </p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          )}

          {/* Memory Type Breakdown */}
          {Object.keys(memoriesByType).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(memoriesByType).map(([type, count]) => (
                <Badge key={type} variant="outline" className={`text-xs ${getMemoryTypeColor(type)}`}>
                  {type}: {count}
                </Badge>
              ))}
            </div>
          )}

          {/* Memory List */}
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-2 pb-4">
              {store.memories.length === 0 ? (
                <div className="text-center py-12">
                  <Brain className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-sm font-medium text-muted-foreground">No memories yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Memories are automatically extracted as you chat
                  </p>
                </div>
              ) : (
                store.memories.map(mem => (
                  <div 
                    key={mem.id} 
                    className="p-3 rounded-lg bg-muted/30 border border-transparent hover:border-border/50 transition-colors space-y-2 group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Badge variant="outline" className={`text-[10px] h-5 ${getMemoryTypeColor(mem.type)}`}>
                        {mem.type}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => store.deleteMemory(mem.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    <p className="text-sm leading-relaxed">{mem.content}</p>
                    <div className="flex flex-wrap gap-1">
                      {mem.keywords.slice(0, 5).map(kw => (
                        <span key={kw} className="text-[10px] text-muted-foreground bg-background/50 px-1.5 py-0.5 rounded">
                          #{kw}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{formatRelativeTime(mem.timestamp)}</span>
                      <div className="flex items-center gap-2">
                        <span>{mem.accessCount} refs</span>
                        <span className="text-yellow-500/70">
                          {'★'.repeat(Math.min(Math.ceil(mem.importance / 2), 5))}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ============================================================
// KEY ICON (simple)
// ============================================================
function Key({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="m21 2-9.3 9.3" />
      <path d="m18.4 4.6-2.8 2.8" />
    </svg>
  );
}
