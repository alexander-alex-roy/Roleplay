'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { useChatStore } from '@/stores/chat-store';
import { useSettingsStore } from '@/stores/settings-store';
import { getModelsForProvider, generateCharacter, enhanceImagePrompt, enhanceCustomAvatarPrompt } from '@/lib/ai-engine';
import type { Character, AIProvider, UserPersona, CharacterTemplate } from '@/lib/types';
import { CHARACTER_TEMPLATES } from '@/lib/types';
import { exportAllData, importAllData, clearAllData } from '@/lib/db';
import {
  MessageSquare, Plus, Settings, Brain, Trash2, Star, Send, Square,
  ChevronLeft, ChevronRight, Pencil, Download, Upload, X, Bot,
  AlertCircle, RefreshCw, Search, Sparkles, Shield, RotateCcw,
  Eye, EyeOff, Zap, BookOpen, Menu
} from 'lucide-react';
import { useIsMobile, useMobileOptimizations } from '@/hooks/use-mobile';
import { useContextMenuStore, ContextMenu, type ContextMenuItem } from '@/hooks/use-context-menu';
import { useToast } from '@/hooks/use-toast';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
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
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const { showConfirm, showAlert } = useConfirmDialog();

  // Mobile optimizations
  useMobileOptimizations();

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
  }, [contextMenu]);

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
    <div className="h-dvh flex overflow-hidden bg-background touch-none">
      {/* Character Sidebar - hidden on mobile */}
      {!isMobile && <CharacterSidebar />}

      {/* Chat History Sidebar - hidden on mobile */}
      {!isMobile && <ChatHistorySidebar />}

      {/* Mobile Nav Sheet */}
      {isMobile && (
        <MobileNavSheet open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
      )}

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {store.activeCharacter && store.activeChat ? (
          <ChatView isMobile={isMobile} onOpenMobileNav={() => setMobileNavOpen(true)} lightboxImage={lightboxImage} setLightboxImage={setLightboxImage} />
        ) : store.activeCharacter ? (
          <EmptyChatView isMobile={isMobile} onOpenMobileNav={() => setMobileNavOpen(true)} lightboxImage={lightboxImage} setLightboxImage={setLightboxImage} />
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
      <ContextMenu state={{ visible: contextMenu.visible, x: contextMenu.x, y: contextMenu.y, items: contextMenu.items }} />

      {/* Image Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setLightboxImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300 p-2"
            onClick={() => setLightboxImage(null)}
          >
            <X className="w-8 h-8" />
          </button>
          <img
            src={lightboxImage}
            alt="Full size"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
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

  const showSetupWizard = settingsStore.settings.showSetupWizard;
  const showWizard = settingsStore.isLoaded && showSetupWizard;

  if (!showWizard) return null;

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
      <DialogContent className="max-w-lg p-0 gap-0" aria-describedby="wizard-description">
        <DialogDescription id="wizard-description" className="sr-only">
          Setup wizard for configuring your AI assistant
        </DialogDescription>
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
                  maxLength={50}
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
                    maxLength={100}
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      if (!text?.trim()) return;
      try {
        const character = await store.importCharacter(text);
        if (character) {
          store.selectCharacter(character);
        }
      } catch (err) {
        console.error('Import failed:', err);
      }
    };
    reader.onerror = () => {
      console.error('Failed to read file');
    };
    reader.readAsText(file);
    // Reset input so same file can be re-imported
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

            <Button
              variant="outline"
              className="w-full gap-2 min-h-[44px]"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4" /> Import Character from File
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.charx"
              className="hidden"
              onChange={handleFileImport}
            />

            {store.characters.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {isMobile 
                  ? 'Or tap the menu to see your characters' 
                  : 'Or select a character from the sidebar →'}
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
function EmptyChatView({ isMobile, onOpenMobileNav, lightboxImage, setLightboxImage }: { isMobile: boolean; onOpenMobileNav: () => void; lightboxImage: string | null; setLightboxImage: (img: string | null) => void }) {
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
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center overflow-hidden">
            {store.activeCharacter.avatar ? (
              <img src={store.activeCharacter.avatar} alt={store.activeCharacter.name} className="w-full h-full object-cover" />
            ) : (
              <Bot className="w-4 h-4" />
            )}
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
          <div
            className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full flex items-center justify-center mx-auto overflow-hidden cursor-zoom-in"
            onClick={() => store.activeCharacter?.avatar && setLightboxImage(store.activeCharacter.avatar!)}
          >
            {store.activeCharacter.avatar ? (
              <img src={store.activeCharacter.avatar} alt={store.activeCharacter.name} className="w-full h-full object-cover" />
            ) : (
              <Bot className="w-10 h-10 sm:w-12 sm:h-12 text-primary" />
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-bold">{store.activeCharacter.name}</h2>
          {store.activeCharacter.description && (
            <p className="text-muted-foreground text-sm line-clamp-3">{store.activeCharacter.description}</p>
          )}
          <Button size="lg" className="gap-2 min-h-[44px]" onClick={() => store.activeCharacter && store.newChat(store.activeCharacter)}>
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
    if (search) {
      const lowerSearch = search.toLowerCase();
      chars = chars.filter(c =>
        c.name.toLowerCase().includes(lowerSearch) ||
        c.tags?.some(t => t.toLowerCase().includes(lowerSearch))
      );
    }
    return chars;
  }, [store.characters, search, showFavorites]);

  return (
    <div className={`${store.sidebarOpen ? 'w-56 sm:w-64' : 'w-0'} transition-all duration-300 border-r border-border bg-card flex flex-col overflow-hidden flex-shrink-0 max-w-full`}>
      <div className="p-3 space-y-3 border-b border-border flex-shrink-0">
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
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="p-2 space-y-1">
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground text-xs py-8">
              {showFavorites ? 'No favorites yet' : 'No characters yet'}
            </p>
          )}
          {filtered.map(char => (
            <CharacterItem key={char.id} character={char} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CharacterItem({ character }: { character: Character }) {
  const store = useChatStore();
  const contextMenu = useContextMenuStore();
  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchCountRef = useRef<number>(0);
  const { showConfirm } = useConfirmDialog();

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (touchTimerRef.current) {
        clearTimeout(touchTimerRef.current);
      }
    };
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
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
      { label: '', onClick: () => {}, separator: true as const },
      {
        label: 'Delete',
        icon: <Trash2 className="w-4 h-4" />,
        destructive: true,
        onClick: async () => {
          const confirmed = await showConfirm({
            title: `Delete "${character.name}"?`,
            description: 'This cannot be undone.',
            confirmText: 'Delete',
            destructive: true,
          });
          if (confirmed) {
            store.deleteCharacter(character.id);
          }
        },
      },
    ]);
  }, [character, contextMenu, store, showConfirm]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Don't trigger on buttons
    if ((e.target as HTMLElement).closest('button')) return;
    
    touchCountRef.current += 1;
    
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
      // Double tap detected
      if (touchCountRef.current >= 2) {
        handleContextMenu(e);
        touchCountRef.current = 0;
      }
    } else {
      touchTimerRef.current = setTimeout(() => {
        touchCountRef.current = 0;
        touchTimerRef.current = null;
      }, 400);
    }
  }, [handleContextMenu]);

  return (
    <div
      className="flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors hover:bg-muted/50 overflow-hidden w-full"
      onClick={() => store.selectCharacter(character)}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
    >
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
        {character.avatar ? (
          <img src={character.avatar} alt={character.name} className="w-full h-full object-cover" />
        ) : (
          <Bot className="w-4 h-4" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{character.name}</p>
        <p className="text-xs text-muted-foreground truncate">
          {character.tags?.slice(0, 2).join(', ') || 'No tags'}
        </p>
      </div>
      <div className="flex gap-0.5 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground"
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
          className="h-6 w-6 text-muted-foreground"
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
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={async (e) => {
            e.stopPropagation();
            const confirmed = await showConfirm({
              title: `Delete "${character.name}"?`,
              description: 'This cannot be undone.',
              confirmText: 'Delete',
              destructive: true,
            });
            if (confirmed) {
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
  const { showConfirm } = useConfirmDialog();

  if (!store.activeCharacter) return null;

  return (
    <div className="w-44 sm:w-52 flex-shrink-0 border-r border-border bg-card flex flex-col overflow-hidden">
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">Chats</h3>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0"
                  onClick={() => {
                    if (store.activeCharacter) store.newChat(store.activeCharacter);
                  }}
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>New Chat</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="p-2 space-y-0.5">
          {store.chats.length === 0 && (
            <p className="text-center text-muted-foreground text-xs py-6">No chats yet</p>
          )}
          {store.chats.map(chat => (
            <div
              key={chat.id}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors min-w-0 ${
                store.activeChat?.id === chat.id ? 'bg-muted' : 'hover:bg-muted/50'
              }`}
              onClick={() => store.selectChat(chat)}
              style={{ minWidth: 0 }}
            >
              <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
              <span className="truncate flex-1 min-w-0" style={{ minWidth: 0 }}>
                {chat.title}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 flex-shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                onClick={async (e) => {
                  e.stopPropagation();
                  const confirmed = await showConfirm({
                    title: 'Delete this chat?',
                    description: 'This cannot be undone.',
                    confirmText: 'Delete',
                    destructive: true,
                  });
                  if (confirmed) {
                    store.deleteChat(chat.id);
                  }
                }}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CHAT VIEW
// ============================================================
function ChatView({ isMobile, onOpenMobileNav, lightboxImage, setLightboxImage }: { isMobile: boolean; onOpenMobileNav: () => void; lightboxImage: string | null; setLightboxImage: (img: string | null) => void }) {
  const store = useChatStore();
  const { showConfirm } = useConfirmDialog();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAutoScrollRef = useRef(true);

  const messages = store.messages;
  const activeCharacter = store.activeCharacter;
  const activeChat = store.activeChat;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (isAutoScrollRef.current && messagesEndRef.current) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      });
    }
  }, [messages]);

  // Detect if user has scrolled up (to not auto-scroll)
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    // If user is within 100px of bottom, consider it auto-scroll
    isAutoScrollRef.current = scrollHeight - scrollTop - clientHeight < 100;
  }, []);

  if (!activeCharacter || !activeChat) return null;

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
        <div className={`rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center overflow-hidden ${isMobile ? 'w-8 h-8' : 'w-8 h-8'}`}>
          {activeCharacter.avatar ? (
            <img src={activeCharacter.avatar} alt={activeCharacter.name} className="w-full h-full object-cover" />
          ) : (
            <Bot className="w-4 h-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className={`font-semibold truncate ${isMobile ? 'text-sm' : 'text-sm'}`}>{activeCharacter.name}</h2>
          {!isMobile && (
            <p className="text-xs text-muted-foreground truncate">{activeChat.title}</p>
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
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => store.setCharacterEditorOpen(true, activeCharacter)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit Character</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={async () => {
                      const confirmed = await showConfirm({
                        title: 'Delete this chat?',
                        description: 'This cannot be undone.',
                        confirmText: 'Delete',
                        destructive: true,
                      });
                      if (confirmed) {
                        store.deleteChat(activeChat.id);
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
        <div className="mx-4 mt-2 px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-sm text-destructive flex-shrink-0">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1 break-words">{store.error}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={store.clearError}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}

      {/* Messages */}
      <div 
        ref={scrollContainerRef} 
        className="flex-1 overflow-y-auto"
        onScroll={handleScroll}
      >
        <div className={`mx-auto p-4 space-y-4 ${isMobile ? 'max-w-full' : 'max-w-3xl'}`}>
          {messages.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                Start a conversation with {activeCharacter.name}
              </p>
            </div>
          )}
          {messages.map(msg => (
            <MessageBubble key={msg.id} message={{
              id: msg.id,
              role: msg.role,
              content: msg.content,
              isStreaming: msg.isStreaming,
              timestamp: msg.timestamp,
              image: msg.metadata?.image,
              lightboxImage,
              setLightboxImage,
            }} />
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
interface MessageData {
  id: string;
  role: string;
  content: string;
  isStreaming?: boolean;
  timestamp: number;
  image?: string;
  lightboxImage?: string | null;
  setLightboxImage?: (img: string | null) => void;
}

function MessageBubble({ message }: { message: MessageData }) {
  const store = useChatStore();
  const contextMenu = useContextMenuStore();
  const { showConfirm } = useConfirmDialog();
  const isUser = message.role === 'user';
  const lastTouchTimeRef = useRef<number>(0);

  const handleContextMenu = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!message.content) return;
    e.preventDefault();
    e.stopPropagation();
    
    const items = [
      {
        label: 'Copy Text',
        icon: <CopyIcon className="w-4 h-4" />,
        onClick: () => {
          navigator.clipboard.writeText(message.content).catch(() => {
            // Fallback for clipboard API failure
            const textarea = document.createElement('textarea');
            textarea.value = message.content;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
          });
        },
      },
    ];

    if (!isUser && !message.isStreaming) {
      items.push({
        label: 'Regenerate',
        icon: <RefreshCw className="w-4 h-4" />,
        onClick: () => store.regenerateMessage(),
      } as any);
    }

    items.push(
      { label: 'Delete', icon: <Trash2 className="w-4 h-4" />, destructive: true, onClick: async () => {
          const confirmed = await showConfirm({
            title: 'Delete this message?',
            description: 'This cannot be undone.',
            confirmText: 'Delete',
            destructive: true,
          });
          if (confirmed) {
            store.deleteMessage(message.id);
          }
        },
      } as any
    );

    contextMenu.show(e, items);
  }, [message.content, message.id, message.isStreaming, isUser, contextMenu, store, showConfirm]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const now = Date.now();
    const timeSinceLastTouch = now - lastTouchTimeRef.current;
    lastTouchTimeRef.current = now;
    
    if (timeSinceLastTouch < 400 && timeSinceLastTouch > 0) {
      handleContextMenu(e);
    }
  }, [handleContextMenu]);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className="group relative max-w-[85%] sm:max-w-[75%]"
        onContextMenu={handleContextMenu}
        onTouchEnd={handleTouchEnd}
      >
        {!isUser && store.activeCharacter && (
          <div className="flex items-center gap-1.5 mb-1 ml-1">
            <div
              className="w-5 h-5 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center overflow-hidden cursor-zoom-in"
              onClick={() => store.activeCharacter?.avatar && message.setLightboxImage?.(store.activeCharacter.avatar!)}
            >
              {store.activeCharacter.avatar ? (
                <img src={store.activeCharacter.avatar} alt={store.activeCharacter.name} className="w-full h-full object-cover" />
              ) : (
                <Bot className="w-3 h-3" />
              )}
            </div>
            <span className="text-xs font-medium text-muted-foreground">{store.activeCharacter.name}</span>
          </div>
        )}
        {message.image && (
          <div className="mt-2 rounded-lg overflow-hidden max-w-full">
            <img
              src={message.image}
              alt="Generated scene"
              className="max-w-[300px] w-full h-auto rounded-lg cursor-zoom-in"
              onClick={() => message.setLightboxImage?.(message.image!)}
            />
          </div>
        )}
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
            isUser
              ? 'bg-blue-600 text-white rounded-tr-sm'
              : 'bg-muted rounded-tl-sm'
          }`}
        >
          {message.content && message.content.trim() !== '[Generated Image]' ? (
            formatMessageContent(message.content)
          ) : message.isStreaming ? (
            <span className="animate-pulse">▊</span>
          ) : null}
          {message.isStreaming && message.content && <span className="animate-pulse ml-0.5">▊</span>}
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
              onClick={() => {
                navigator.clipboard.writeText(message.content).catch(() => {
                  const textarea = document.createElement('textarea');
                  textarea.value = message.content;
                  textarea.style.position = 'fixed';
                  textarea.style.opacity = '0';
                  document.body.appendChild(textarea);
                  textarea.select();
                  document.execCommand('copy');
                  document.body.removeChild(textarea);
                });
              }}
              aria-label="Copy message"
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

// Format message content with styling for markdown-like syntax
function formatMessageContent(content: string): React.ReactNode {
  if (!content) return null;

  const elements: React.ReactNode[] = [];
  let keyCounter = 0;

  // We parse the content sequentially, finding the next special token
  // regardless of where it appears in the string.
  let remaining = content;

  while (remaining.length > 0) {
    // Find the earliest occurrence of any token starter
    const boldIdx = remaining.indexOf('**');
    const asteriskIdx = remaining.indexOf('*');
    const doubleQuoteIdx = remaining.indexOf('"');
    const singleQuoteIdx = remaining.indexOf("'");

    // Build a list of candidate positions, filter out -1 (not found)
    const candidates: [number, 'bold' | 'action' | 'dialogue' | 'singleDialogue'][] = [];
    if (boldIdx !== -1) candidates.push([boldIdx, 'bold']);
    // For action, we need a single `*` that is NOT part of `**`
    // We'll handle this below by checking the character after `*`
    if (doubleQuoteIdx !== -1) candidates.push([doubleQuoteIdx, 'dialogue']);
    if (singleQuoteIdx !== -1) candidates.push([singleQuoteIdx, 'singleDialogue']);

    // Also find single `*` that is not part of `**`
    let actionIdx = -1;
    if (asteriskIdx !== -1) {
      // If it's `**`, skip unless the second `*` is also there (bold)
      if (remaining.startsWith('**', asteriskIdx)) {
        // This is a bold candidate, not action
        // boldIdx already handles this
      } else {
        actionIdx = asteriskIdx;
        candidates.push([actionIdx, 'action']);
      }
    }

    if (candidates.length === 0) {
      // No more special tokens — push remaining as plain text
      elements.push(<span key={keyCounter++}>{remaining}</span>);
      break;
    }

    // Sort by index to find the earliest token
    candidates.sort((a, b) => a[0] - b[0]);
    const [matchIdx, tokenType] = candidates[0];

    // Push any plain text before this token
    if (matchIdx > 0) {
      elements.push(<span key={keyCounter++}>{remaining.slice(0, matchIdx)}</span>);
    }

    if (tokenType === 'bold') {
      // Find closing **
      const closeIdx = remaining.indexOf('**', matchIdx + 2);
      if (closeIdx !== -1) {
        const inner = remaining.slice(matchIdx + 2, closeIdx);
        if (inner.length > 0) {
          elements.push(<span key={keyCounter++} className="font-bold">{inner}</span>);
          remaining = remaining.slice(closeIdx + 2);
        } else {
          // Empty bold — treat as literal text
          elements.push(<span key={keyCounter++}>**</span>);
          remaining = remaining.slice(2);
        }
      } else {
        // No closing ** — treat as literal
        elements.push(<span key={keyCounter++}>**</span>);
        remaining = remaining.slice(2);
      }
    } else if (tokenType === 'action') {
      // Find closing * (but not **)
      let closeIdx = -1;
      for (let i = matchIdx + 1; i < remaining.length; i++) {
        if (remaining[i] === '*' && (i + 1 >= remaining.length || remaining[i + 1] !== '*')) {
          closeIdx = i;
          break;
        }
      }
      if (closeIdx !== -1 && closeIdx > matchIdx + 1) {
        const inner = remaining.slice(matchIdx + 1, closeIdx);
        if (inner.length > 0) {
          elements.push(<span key={keyCounter++} className="italic text-muted-foreground">*{inner}*</span>);
          remaining = remaining.slice(closeIdx + 1);
        } else {
          elements.push(<span key={keyCounter++}>*</span>);
          remaining = remaining.slice(1);
        }
      } else {
        // No closing * — treat as literal
        elements.push(<span key={keyCounter++}>*</span>);
        remaining = remaining.slice(1);
      }
    } else if (tokenType === 'dialogue') {
      const closeIdx = remaining.indexOf('"', matchIdx + 1);
      if (closeIdx !== -1) {
        const inner = remaining.slice(matchIdx + 1, closeIdx);
        if (inner.length > 0) {
          elements.push(<span key={keyCounter++} className="text-foreground font-medium">&ldquo;{inner}&rdquo;</span>);
          remaining = remaining.slice(closeIdx + 1);
        } else {
          elements.push(<span key={keyCounter++}>""</span>);
          remaining = remaining.slice(2);
        }
      } else {
        elements.push(<span key={keyCounter++}>"</span>);
        remaining = remaining.slice(1);
      }
    } else if (tokenType === 'singleDialogue') {
      const closeIdx = remaining.indexOf("'", matchIdx + 1);
      if (closeIdx !== -1) {
        const inner = remaining.slice(matchIdx + 1, closeIdx);
        if (inner.length > 0) {
          elements.push(<span key={keyCounter++} className="text-foreground font-medium">&lsquo;{inner}&rsquo;</span>);
          remaining = remaining.slice(closeIdx + 1);
        } else {
          elements.push(<span key={keyCounter++}>''</span>);
          remaining = remaining.slice(2);
        }
      } else {
        elements.push(<span key={keyCounter++}>'</span>);
        remaining = remaining.slice(1);
      }
    }
  }

  return elements;
}

// ============================================================
// CHAT INPUT
// ============================================================
function ChatInput() {
  const store = useChatStore();
  const settingsStore = useSettingsStore();
  const { toast } = useToast();
  const { showConfirm } = useConfirmDialog();
  const [text, setText] = useState('');
  const [generatingImage, setGeneratingImage] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const settings = useSettingsStore(s => s.settings);
  const activeChatId = store.activeChat?.id;
  const models = useMemo(() => getModelsForProvider(settings.activeProvider), [settings.activeProvider]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || store.isStreaming) return;
    store.sendMessage(trimmed);
    setText('');
    // Reset textarea height
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    });
  }, [text, store.isStreaming, store]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && settings.sendOnEnter) {
      e.preventDefault();
      handleSend();
    }
  }, [settings.sendOnEnter, handleSend]);

  const handleInput = useCallback(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      const newHeight = Math.min(ta.scrollHeight, 200);
      ta.style.height = newHeight + 'px';
    }
  }, []);

  // Focus textarea when chat changes
  useEffect(() => {
    if (activeChatId && textareaRef.current) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [activeChatId]);

  const characterName = store.activeCharacter?.name || '...';

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
              placeholder={`Message ${characterName}...`}
              className="min-h-[44px] max-h-[200px] resize-none pr-12 rounded-xl text-sm"
              rows={1}
              disabled={store.isStreaming}
              maxLength={10000}
            />
          </div>
          {store.isStreaming ? (
            <Button
              variant="destructive"
              size="icon"
              className="h-10 w-10 rounded-xl flex-shrink-0"
              onClick={store.stopStreaming}
              aria-label="Stop generating"
            >
              <Square className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              className="h-10 w-10 rounded-xl flex-shrink-0"
              onClick={handleSend}
              disabled={!text.trim()}
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </Button>
          )}
        </div>
        <div className="flex items-center justify-between mt-1.5 px-1">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 cursor-pointer hover:bg-accent transition-colors">
                  {settings.activeModel || 'No model'}
                </Badge>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-64 w-56">
                <DropdownMenuLabel className="text-xs">Switch Model</DropdownMenuLabel>
                {models.map(m => (
                  <DropdownMenuItem
                    key={m.id}
                    onClick={() => settingsStore.setActiveModel(m.id)}
                    className="text-xs py-1"
                  >
                    <span className="truncate">{m.name}</span>
                    {m.id === settings.activeModel && (
                      <span className="ml-auto text-muted-foreground text-[10px]">✓</span>
                    )}
                  </DropdownMenuItem>
                ))}
                {settings.activeProvider === 'custom' || settings.activeProvider === 'local' ? (
                  <DropdownMenuSeparator />
                ) : null}
                {settings.activeProvider === 'custom' || settings.activeProvider === 'local' ? (
                  <DropdownMenuItem
                    onClick={() => {
                      const model = prompt('Enter custom model ID:');
                      if (model?.trim()) {
                        settingsStore.setActiveModel(model.trim());
                      }
                    }}
                    className="text-xs py-1 text-muted-foreground italic"
                  >
                    + Custom model...
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
            {store.messages.length > 0 && (
              <span>{store.messages.length} <span className="hidden sm:inline">messages</span><span className="sm:hidden">msgs</span></span>
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
                    aria-label="Regenerate"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Regenerate last response</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {settings.activeProvider === 'nvidia' && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={async () => {
                        if (!store.activeCharacter || generatingImage) return;
                        const nvidiaConfig = settings.providers.find(p => p.provider === 'nvidia');
                        if (!nvidiaConfig?.apiKey) return;
                        
                        setGeneratingImage(true);
                        try {
                          const recentMessages = store.messages.slice(-6);
                          const lastAction = recentMessages.find(m => m.role === 'user' || m.role === 'assistant');
                          const sceneContext = lastAction ? lastAction.content.slice(0, 150) : '';
                          
                          const charName = store.activeCharacter.name;
                          const charDesc = store.activeCharacter.description || '';
                          const charPersonality = store.activeCharacter.personality || '';
                          
                          const imageModel = settings.nvidiaImageModel || 'stabilityai/stable-diffusion-3-medium';
                          
                          const modelDefaults: Record<string, { steps: number; cfg_scale: number }> = {
                            'stabilityai/stable-diffusion-3-medium': { steps: 50, cfg_scale: 5 },
                            'stabilityai/stable-diffusion-xl': { steps: 25, cfg_scale: 5 },
                            'black-forest-labs/flux.1-dev': { steps: 50, cfg_scale: 5 },
                            'black-forest-labs/flux.1-schnell': { steps: 4, cfg_scale: 0 },
                            'black-forest-labs/flux.2-klein-4b': { steps: 4, cfg_scale: 1 },
                          };
                          const defaults = modelDefaults[imageModel] || { steps: 50, cfg_scale: 5 };
                          
                          let basePrompt = `cinematic portrait of ${charName}, ${charDesc.slice(0, 150)}, ${charPersonality.slice(0, 80)}, natural lighting, atmospheric, depth of field, 16:9`;
                          if (sceneContext) {
                            basePrompt += `, scene: ${sceneContext}`;
                          }

                          // Enforce per-model prompt limits to avoid truncation by the API
                          const maxLen = imageModel.includes('flux') ? 790
                            : imageModel.includes('stable-diffusion-3') ? 400
                            : imageModel.includes('stable-diffusion-xl') ? 300
                            : 400;

                          let finalPrompt = basePrompt.slice(0, maxLen);
                          if (settings.enhanceImagePrompts) {
                            try {
                              finalPrompt = await enhanceImagePrompt(
                                settingsStore.settings,
                                finalPrompt,
                                `This is for a scene/background image.`,
                                { model: imageModel.split('/').pop() || imageModel, maxChars: maxLen },
                              );
                              // Safety truncation — AI should already respect the limit
                              if (finalPrompt.length > maxLen) finalPrompt = finalPrompt.slice(0, maxLen);
                            } catch (e) {
                              console.error('Prompt enhancement failed, using base prompt:', e);
                              finalPrompt = basePrompt.slice(0, maxLen);
                            }
                          }
                          
                          const response = await fetch('https://roleplay.jameskaren.workers.dev/v1/genai', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              prompt: finalPrompt,
                              model: imageModel,
                              cfg_scale: defaults.cfg_scale,
                              aspect_ratio: "16:9",
                              seed: Math.floor(Math.random() * 1000000),
                              steps: defaults.steps,
                              negative_prompt: imageModel.includes('flux') ? undefined : "cartoon, anime, illustration, drawing, painting, 3d render, deformed, distorted, low quality, blurry, text, watermark, signature",
                              apiKey: nvidiaConfig.apiKey,
                            }),
                          });
                          
                          if (response.ok) {
                            const data = await response.json();
                            const finishReason = data.artifacts?.[0]?.finishReason || data.artifacts?.[0]?.finish_reason;
                            
                            if (finishReason === 'CONTENT_FILTERED') {
                              toast({
                                variant: 'destructive',
                                title: 'Image generation failed',
                                description: 'Content filtered by NVIDIA. Try a different description or model.',
                              });
                              setGeneratingImage(false);
                              return;
                            }
                            
                            let base64Data: string | null = null;
                            
                            // Check various response formats
                            if (data.image) {
                              base64Data = data.image.startsWith('data:')
                                ? data.image
                                : `data:image/jpeg;base64,${data.image}`;
                            } else if (data.artifacts && data.artifacts.length > 0) {
                              const artifact = data.artifacts[0];
                              // Try base64, image, or encode the artifact differently
                              const rawBase64 = artifact.base64 || artifact.image;
                              if (rawBase64) {
                                base64Data = rawBase64.startsWith('data:')
                                  ? rawBase64
                                  : `data:image/jpeg;base64,${rawBase64}`;
                              }
                            } else if (data.images && data.images[0]) {
                              base64Data = data.images[0].startsWith('data:')
                                ? data.images[0]
                                : `data:image/jpeg;base64,${data.images[0]}`;
                            }
                            
                            if (base64Data) {
                              await store.addImageMessage(base64Data, imageModel);
                            }
                          } else {
                            const errBody = await response.text();
                            console.error('Scene image generation failed:', response.status, errBody);
                          }
                        } catch (e) {
                          console.error('Image generation failed:', e);
                        } finally {
                          setGeneratingImage(false);
                        }
                      }}
                      disabled={generatingImage || store.isStreaming || !store.activeCharacter}
                      aria-label="Generate scene image"
                    >
                      {generatingImage ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Generate scene image</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive"
                    onClick={async () => {
                      const lastMsg = store.messages[store.messages.length - 1];
                      if (lastMsg) {
                        const confirmed = await showConfirm({
                          title: 'Delete the last message?',
                          description: 'This cannot be undone.',
                          confirmText: 'Delete',
                          destructive: true,
                        });
                        if (confirmed) {
                          store.deleteMessage(lastMsg.id);
                        }
                      }
                    }}
                    disabled={store.isStreaming || store.messages.length === 0}
                    aria-label="Delete last message"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete last message</TooltipContent>
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
  const { showConfirm, showAlert } = useConfirmDialog();
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
    { id: 'ollamax', name: 'OllamaX', baseUrl: 'http://localhost:3000/v1', defaultModel: 'llama3.2' },
    { id: 'llamacpp', name: 'llama.cpp', baseUrl: 'http://localhost:8080/v1', defaultModel: 'model' },
    { id: 'custom', name: 'Custom URL', baseUrl: '', defaultModel: '' },
  ];

  const [localPreset, setLocalPreset] = useState('ollama');
  const [customModelInput, setCustomModelInput] = useState('');
  const [useCustomModel, setUseCustomModel] = useState(false);

  const handleAddProvider = async () => {
    if (!newProvider) return;
    if (newProvider !== 'local' && !newKey.trim()) return;
    
    await settingsStore.setProvider({
      provider: newProvider,
      apiKey: newKey.trim() || (newProvider === 'local' ? 'local' : ''),
      baseUrl: newBaseUrl || undefined,
      enabled: true,
    });
    // Auto-select the new provider
    await settingsStore.setActiveProvider(newProvider);
    
    // If local preset was selected, also set the model
    if (newProvider === 'local') {
      const preset = localPresets.find(p => p.id === localPreset);
      if (preset && preset.id !== 'custom' && preset.defaultModel) {
        await settingsStore.setActiveModel(preset.defaultModel);
      }
    }
    
    setNewProvider('');
    setNewKey('');
    setNewBaseUrl('');
  };

  const handleExportData = async () => {
    try {
      const data = await exportAllData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `roleplay-chat-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      showAlert({ title: 'Export Failed', description: 'Failed to export data. Please try again.', variant: 'error' });
    }
  };

  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await importAllData(text);
      store.loadCharacters();
      settingsStore.loadSettings();
    } catch (err) {
      console.error('Import failed:', err);
      showAlert({ title: 'Import Failed', description: 'Failed to import data. Please check the file format.', variant: 'error' });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClearData = async () => {
    const confirmed = await showConfirm({
      title: 'Clear All Data?',
      description: 'This will delete ALL characters, chats, messages, and memories permanently. This cannot be undone.',
      confirmText: 'Clear All',
      destructive: true,
    });
    if (confirmed) {
      try {
        await clearAllData();
        store.loadCharacters();
        settingsStore.loadSettings();
      } catch (err) {
        console.error('Clear failed:', err);
      }
    }
  };

  const models = useMemo(() => getModelsForProvider(settings.activeProvider), [settings.activeProvider]);

  // Reset custom model toggle when provider changes
  useEffect(() => {
    setUseCustomModel(false);
    setCustomModelInput('');
  }, [settings.activeProvider]);

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
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden" aria-describedby="settings-description">
        <DialogDescription id="settings-description" className="sr-only">
          Application settings and configuration
        </DialogDescription>
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
          <div className="flex-1 min-h-0 overflow-y-auto p-4 touch-pan-y">
            <div className="space-y-4">
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
                          try {
                            const result = await settingsStore.testConnection();
                            setTestResult(result);
                          } catch (err) {
                            setTestResult({ success: false, message: 'Connection test failed' });
                          } finally {
                            setTesting(false);
                          }
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
                        <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      ) : (
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      )}
                      <span className="flex-1 break-words">{testResult.message}</span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-5 w-5 flex-shrink-0" 
                        onClick={() => setTestResult(null)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}

                  {/* Configured providers */}
                  <div className="space-y-2">
                    {settings.providers.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No providers configured. Add one below.
                      </p>
                    )}
                    {settings.providers.map(p => {
                      const providerInfo = providers.find(pr => pr.id === p.provider);
                      return (
                        <div key={p.provider} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                          <span className="text-lg flex-shrink-0">
                            {providerInfo?.icon || '🔑'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{providerInfo?.name || p.provider}</p>
                            <p className="text-xs text-muted-foreground font-mono truncate">
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
                            className="h-7 w-7 shrink-0 hover:text-destructive"
                            onClick={() => settingsStore.removeProvider(p.provider)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Add new provider */}
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Add Provider</p>
                    <Select value={newProvider || ''} onValueChange={(v) => {
                      setNewProvider(v as AIProvider);
                      setNewKey('');
                      setNewBaseUrl('');
                    }}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Select provider..." />
                      </SelectTrigger>
                      <SelectContent>
                        {providers.filter(p => !settings.providers.some(sp => sp.provider === p.id)).map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.icon} {p.name}</SelectItem>
                        ))}
                        {settings.providers.length === providers.length && (
                          <SelectItem value="_none" disabled>All providers added</SelectItem>
                        )}
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
                        autoComplete="off"
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
                      disabled={!newProvider || (newProvider !== 'local' && !newKey.trim())} 
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
                        const isChecked = checked === true;
                        setUseCustomModel(isChecked);
                        if (!isChecked) {
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
                        maxLength={200}
                      />
                      <p className="text-xs text-muted-foreground">
                        Enter the exact model ID your API provider expects
                      </p>
                    </div>
                  ) : (
                    <Select 
                      value={settings.activeModel} 
                      onValueChange={(v) => settingsStore.setActiveModel(v)}
                    >
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Select a model" />
                      </SelectTrigger>
                      <SelectContent>
                        {models.length > 0 ? (
                          models.map(m => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name}
                              <span className="text-muted-foreground ml-2 text-xs">
                                ({(m.maxContextTokens / 1000).toFixed(0)}k ctx)
                              </span>
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="_none" disabled>
                            No models available for {settings.activeProvider}
                          </SelectItem>
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
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground hidden sm:inline">Higher = more creative</span>
                          {settings.temperature !== 0.7 && (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => settingsStore.updateSetting('temperature', 0.7)} aria-label="Reset to default" title="Reset to 0.7">
                              <RotateCcw className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <Slider
                        value={[settings.temperature]}
                        min={0} max={2} step={0.05}
                        onValueChange={([v]) => settingsStore.updateSetting('temperature', v)}
                        className="touch-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <Label>Max Tokens: {settings.maxTokens}</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground hidden sm:inline">Max response length</span>
                          {settings.maxTokens !== 512 && (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => settingsStore.updateSetting('maxTokens', 512)} aria-label="Reset to default" title="Reset to 512">
                              <RotateCcw className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <Slider
                        value={[settings.maxTokens]}
                        min={64} max={4096} step={64}
                        onValueChange={([v]) => settingsStore.updateSetting('maxTokens', v)}
                        className="touch-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <Label>Top P: {settings.topP.toFixed(2)}</Label>
                        {settings.topP !== 0.9 && (
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => settingsStore.updateSetting('topP', 0.9)} aria-label="Reset to default" title="Reset to 0.9">
                            <RotateCcw className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                      <Slider
                        value={[settings.topP]}
                        min={0} max={1} step={0.05}
                        onValueChange={([v]) => settingsStore.updateSetting('topP', v)}
                        className="touch-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <Label>Frequency Penalty: {settings.frequencyPenalty.toFixed(2)}</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground hidden sm:inline">Reduce repetition</span>
                          {settings.frequencyPenalty !== 0.1 && (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => settingsStore.updateSetting('frequencyPenalty', 0.1)} aria-label="Reset to default" title="Reset to 0.1">
                              <RotateCcw className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <Slider
                        value={[settings.frequencyPenalty]}
                        min={0} max={2} step={0.1}
                        onValueChange={([v]) => settingsStore.updateSetting('frequencyPenalty', v)}
                        className="touch-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <Label>Presence Penalty: {settings.presencePenalty.toFixed(2)}</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground hidden sm:inline">Encourage new topics</span>
                          {settings.presencePenalty !== 0.1 && (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => settingsStore.updateSetting('presencePenalty', 0.1)} aria-label="Reset to default" title="Reset to 0.1">
                              <RotateCcw className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <Slider
                        value={[settings.presencePenalty]}
                        min={0} max={2} step={0.1}
                        onValueChange={([v]) => settingsStore.updateSetting('presencePenalty', v)}
                        className="touch-none"
                      />
                    </div>
                  </div>

                  {settings.activeProvider === 'nvidia' && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium">Image Generation Model</h4>
                        <p className="text-xs text-muted-foreground">Select which NVIDIA model to use for generating images</p>
                        <Select 
                          value={settings.nvidiaImageModel} 
                          onValueChange={(v) => settingsStore.updateSetting('nvidiaImageModel', v)}
                        >
                          <SelectTrigger className="text-sm"><SelectValue placeholder="Select image model" /></SelectTrigger>
                          <SelectContent className="max-w-[280px]">
                            <SelectItem value="stabilityai/stable-diffusion-3-medium">
                              <span className="truncate">SD 3 Medium <span className="text-muted-foreground ml-1 text-xs">(balanced)</span></span>
                            </SelectItem>
                            <SelectItem value="stabilityai/stable-diffusion-xl">
                              <span className="truncate">SD XL <span className="text-muted-foreground ml-1 text-xs">(detailed)</span></span>
                            </SelectItem>
                            <SelectItem value="black-forest-labs/flux.1-dev">
                              <span className="truncate">FLUX.1 Dev <span className="text-muted-foreground ml-1 text-xs">(slower)</span></span>
                            </SelectItem>
                            <SelectItem value="black-forest-labs/flux.1-schnell">
                              <span className="truncate">FLUX.1 Schnell <span className="text-muted-foreground ml-1 text-xs">(fast)</span></span>
                            </SelectItem>
                            <SelectItem value="black-forest-labs/flux.2-klein-4b">
                              <span className="truncate">FLUX.2 Klein 4B <span className="text-muted-foreground ml-1 text-xs">(compact)</span></span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-sm">Enhance Prompts</Label>
                            <p className="text-xs text-muted-foreground">Use AI to improve prompts before generating images</p>
                          </div>
                          <Switch
                            checked={settings.enhanceImagePrompts}
                            onCheckedChange={(v) => settingsStore.updateSetting('enhanceImagePrompts', v)}
                          />
                        </div>
                      </div>
                    </>
                  )}
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
                      maxLength={50}
                    />
                  </div>

                  <div>
                    <Label className="text-sm">Your Description</Label>
                    <Textarea
                      value={settings.userPersona.description}
                      onChange={(e) => settingsStore.updateUserPersona({ description: e.target.value })}
                      placeholder="Your appearance, background, who you are in the story..."
                      className="mt-1 min-h-[80px]"
                      maxLength={2000}
                    />
                  </div>

                  <div>
                    <Label className="text-sm">Your Personality</Label>
                    <Textarea
                      value={settings.userPersona.personality || ''}
                      onChange={(e) => settingsStore.updateUserPersona({ personality: e.target.value })}
                      placeholder="Your traits, behavior patterns, communication style..."
                      className="mt-1 min-h-[60px]"
                      maxLength={1000}
                    />
                  </div>

                  <div>
                    <Label className="text-sm">Your Speech Style</Label>
                    <Textarea
                      value={settings.userPersona.speechPatterns || ''}
                      onChange={(e) => settingsStore.updateUserPersona({ speechPatterns: e.target.value })}
                      placeholder="How you typically speak - formal, casual, uses certain phrases..."
                      className="mt-1 min-h-[60px]"
                      maxLength={1000}
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
                          settingsStore.updateUserPersona({ 
                            name: '', 
                            description: '', 
                            personality: '', 
                            speechPatterns: '' 
                          });
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
                        {settings.maxMemoriesPerQuery !== 10 && (
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => settingsStore.updateSetting('maxMemoriesPerQuery', 10)} aria-label="Reset to default" title="Reset to 10">
                            <RotateCcw className="w-3 h-3" />
                          </Button>
                        )}
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
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground hidden sm:inline">Only store memories above this</span>
                            {settings.memoryImportanceThreshold !== 3 && (
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => settingsStore.updateSetting('memoryImportanceThreshold', 3)} aria-label="Reset to default" title="Reset to 3">
                                <RotateCcw className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
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
                        {settings.summarizeThreshold !== 6 && (
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => settingsStore.updateSetting('summarizeThreshold', 6)} aria-label="Reset to default" title="Reset to 6">
                            <RotateCcw className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                      <Slider
                        value={[settings.summarizeThreshold]}
                        min={8} max={50} step={2}
                        onValueChange={([v]) => settingsStore.updateSetting('summarizeThreshold', v)}
                        className="touch-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <Label>Keep Recent Messages: {settings.keepRecentCount}</Label>
                        {settings.keepRecentCount !== 6 && (
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => settingsStore.updateSetting('keepRecentCount', 6)} aria-label="Reset to default" title="Reset to 6">
                            <RotateCcw className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                      <Slider
                        value={[settings.keepRecentCount]}
                        min={2} max={20} step={1}
                        onValueChange={([v]) => settingsStore.updateSetting('keepRecentCount', v)}
                        className="touch-none"
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
                        maxLength={3000}
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
                        maxLength={5000}
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
                        try {
                          const json = store.exportCharacter(store.activeCharacter!);
                          const blob = new Blob([json], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `${store.activeCharacter!.name.replace(/[^a-z0-9]/gi, '_')}.json`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                        } catch (err) {
                          console.error('Export character failed:', err);
                        }
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
            </div>
          </div>
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
  const editingCharacter = store.editingCharacter;
  
  return (
    <Dialog open={store.characterEditorOpen} onOpenChange={(open) => {
      if (!open) store.setCharacterEditorOpen(false);
    }}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0" aria-describedby="character-editor-description">
        <DialogDescription id="character-editor-description" className="sr-only">
          Character editor for creating and modifying AI characters
        </DialogDescription>
        <CharacterEditorInner key={editingCharacter?.id || 'new'} />
      </DialogContent>
    </Dialog>
  );
}

function CharacterEditorInner() {
  const store = useChatStore();
  const settingsStore = useSettingsStore();
  const { toast } = useToast();
  const { showConfirm } = useConfirmDialog();
  const [lightboxOpen, setLightboxOpen] = useState(false);
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
    customAvatarPrompt: initialCharacter?.customAvatarPrompt || '',
    useCustomAvatarPrompt: initialCharacter?.useCustomAvatarPrompt || false,
    lastUsedPrompt: initialCharacter?.lastUsedPrompt || '',
  }));

  const [tagInput, setTagInput] = useState('');

  const handleSave = useCallback(() => {
    if (!form.name?.trim()) return;
    
    const character: Character = {
      id: initialCharacter?.id || `char_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: form.name.trim(),
      avatar: form.avatar || undefined,
      description: form.description || '',
      personality: form.personality || '',
      scenario: form.scenario || '',
      firstMessage: form.firstMessage || '',
      exampleMessages: form.exampleMessages || '',
      systemPrompt: form.systemPrompt || undefined,
      creatorNotes: form.creatorNotes || '',
      tags: form.tags || [],
      createdAt: initialCharacter?.createdAt || Date.now(),
      updatedAt: Date.now(),
      isFavorite: initialCharacter?.isFavorite || false,
      speechPatterns: form.speechPatterns || undefined,
      knowledge: form.knowledge || undefined,
      relationship: form.relationship || undefined,
      likes: form.likes || undefined,
      dislikes: form.dislikes || undefined,
      behavior: form.behavior || undefined,
      customAvatarPrompt: form.customAvatarPrompt || undefined,
      useCustomAvatarPrompt: form.useCustomAvatarPrompt || undefined,
      lastUsedPrompt: form.lastUsedPrompt || undefined,
    };

    store.saveCharacter(character);
    store.setCharacterEditorOpen(false);
    if (!isEditing) {
      store.selectCharacter(character);
    }
  }, [form, initialCharacter, isEditing, store]);

  const addTag = useCallback(() => {
    const trimmed = tagInput.trim();
    if (!trimmed) return;
    if (form.tags?.includes(trimmed)) {
      setTagInput('');
      return;
    }
    setForm(f => ({ ...f, tags: [...(f.tags || []), trimmed] }));
    setTagInput('');
  }, [tagInput, form.tags]);

  const removeTag = useCallback((tag: string) => {
    setForm(f => ({ ...f, tags: (f.tags || []).filter(t => t !== tag) }));
  }, []);

  const [activeField, setActiveField] = useState(isEditing ? 'identity' : 'templates');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [enhancingPrompt, setEnhancingPrompt] = useState(false);
  const [generationPrompt, setGenerationPrompt] = useState('');
  const [generationError, setGenerationError] = useState<string | null>(null);

  const handleGenerateCharacter = useCallback(async () => {
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
          knowledge: generated.knowledge,
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
  }, [generationPrompt, settingsStore.settings]);

  const fields = [
    { id: 'templates', label: 'Templates', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'identity', label: 'Identity', icon: <Bot className="w-4 h-4" /> },
    { id: 'personality', label: 'Personality', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'scenario', label: 'Scenario', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'advanced', label: 'Advanced', icon: <Settings className="w-4 h-4" /> },
  ];

  const applyTemplate = useCallback((template: CharacterTemplate) => {
    if (!template.character) return;
    setSelectedTemplate(template.id);
    setForm(f => ({
      ...f,
      ...template.character,
      tags: template.character.tags || f.tags,
    }));
  }, []);

  const updateForm = useCallback(<K extends keyof Character>(key: K, value: Character[K]) => {
    setForm(f => ({ ...f, [key]: value }));
  }, []);

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
        <ScrollArea className="flex-1 p-4 overflow-y-auto touch-pan-y">
          {activeField === 'templates' && (
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
                  maxLength={500}
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
                    onClick={async () => {
                      if (isEditing && form.name) {
                        const confirmed = await showConfirm({
                          title: 'Apply Template?',
                          description: 'This will replace your current character fields. Continue?',
                          confirmText: 'Apply',
                        });
                        if (confirmed) {
                          applyTemplate(template);
                        }
                      } else {
                        applyTemplate(template);
                      }
                    }}
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

          {activeField === 'identity' && (
            <div className="space-y-3">
              <div>
                <Label className="text-sm">Name *</Label>
                <Input
                  value={form.name || ''}
                  onChange={(e) => updateForm('name', e.target.value)}
                  placeholder="Character name"
                  className="mt-1"
                  maxLength={100}
                />
              </div>
              <div>
                <Label className="text-sm">Avatar URL</Label>
                {form.avatar && (
                  <div className="mt-2 flex justify-center">
                    <div className="relative w-24 h-24 rounded-full overflow-hidden bg-muted border-2 border-border cursor-zoom-in group" onClick={() => setLightboxOpen(true)}>
                      <img src={form.avatar} alt="Avatar preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        className="absolute top-0 right-0 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        onClick={(e) => { e.stopPropagation(); updateForm('avatar', ''); }}
                        aria-label="Remove avatar"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
                {lightboxOpen && form.avatar && (
                  <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out" onClick={() => setLightboxOpen(false)}>
                    <button className="absolute top-4 right-4 text-white hover:text-gray-300 p-2" onClick={() => setLightboxOpen(false)}>
                      <X className="w-8 h-8" />
                    </button>
                    <img src={form.avatar} alt="Avatar full size" className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
                  </div>
                )}
                <div className="flex gap-2 mt-1">
                  <Input
                    value={form.avatar || ''}
                    onChange={(e) => updateForm('avatar', e.target.value)}
                    placeholder="https://..."
                    className="flex-1"
                  />
                  {settingsStore.settings.activeProvider === 'nvidia' && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        if (!form.name) return;
                        const nvidiaConfig = settingsStore.settings.providers.find(p => p.provider === 'nvidia');
                        if (!nvidiaConfig?.apiKey) return;
                        setGenerating(true);
                        try {
                        const charName = form.name || 'character';
                        const charDesc = form.description || '';
                        const charPersonality = form.personality || '';
                        const customPrompt = form.customAvatarPrompt;
                        const useCustom = form.useCustomAvatarPrompt;
                        
                        const imageModel = settingsStore.settings.nvidiaImageModel || 'stabilityai/stable-diffusion-3-medium';
                        
                        const modelDefaults: Record<string, { steps: number; cfg_scale: number }> = {
                          'stabilityai/stable-diffusion-3-medium': { steps: 50, cfg_scale: 5 },
                          'stabilityai/stable-diffusion-xl': { steps: 25, cfg_scale: 5 },
                          'black-forest-labs/flux.1-dev': { steps: 50, cfg_scale: 5 },
                          'black-forest-labs/flux.1-schnell': { steps: 4, cfg_scale: 0 },
                          'black-forest-labs/flux.2-klein-4b': { steps: 4, cfg_scale: 1 },
                        };
                        const defaults = modelDefaults[imageModel] || { steps: 50, cfg_scale: 5 };
                        
                        let basePrompt = '';
                        if (useCustom && customPrompt && customPrompt.trim()) {
                          basePrompt = customPrompt.trim();
                        } else {
                          basePrompt = `portrait of ${charName}, ${charDesc.slice(0, 180)}, ${charPersonality.slice(0, 100)}, natural lighting, soft shadows, high detail, 8k, professional photo, headshot`;
                        }
                        
                        // Enforce per-model prompt limits
                        const maxLen = imageModel.includes('flux') ? 790
                          : imageModel.includes('stable-diffusion-3') ? 400
                          : imageModel.includes('stable-diffusion-xl') ? 300
                          : 400;

                        let finalPrompt = basePrompt.slice(0, maxLen);
                        if (settingsStore.settings.enhanceImagePrompts && !useCustom) {
                          try {
                            finalPrompt = await enhanceImagePrompt(
                              settingsStore.settings,
                              finalPrompt,
                              `This is for a portrait/avatar image.`,
                              { model: imageModel.split('/').pop() || imageModel, maxChars: maxLen },
                            );
                            // Safety truncation — AI should already respect the limit
                            if (finalPrompt.length > maxLen) finalPrompt = finalPrompt.slice(0, maxLen);
                          } catch (e) {
                            console.error('Prompt enhancement failed, using base prompt:', e);
                            finalPrompt = basePrompt.slice(0, maxLen);
                          }
                        }
                        
                        const response = await fetch('https://roleplay.jameskaren.workers.dev/v1/genai', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                              prompt: finalPrompt,
                              model: imageModel,
                              cfg_scale: defaults.cfg_scale,
                              aspect_ratio: "1:1",
                              seed: Math.floor(Math.random() * 1000000),
                              steps: defaults.steps,
                              negative_prompt: imageModel.includes('flux') ? undefined : "cartoon, anime, illustration, drawing, painting, 3d render, deformed, distorted, disfigured, mutation, mutated, ugly, bad anatomy, bad proportions, blurry, low quality, watermark, text",
                              apiKey: nvidiaConfig.apiKey,
                            }),
                          });
                          if (!response.ok) {
                            const errBody = await response.text();
                            throw new Error(`Image generation failed (${response.status}): ${errBody.slice(0, 200)}`);
                          }
                          const response_body = await response.json();
                          const finishReason = response_body.artifacts?.[0]?.finishReason || response_body.artifacts?.[0]?.finish_reason;
                          if (finishReason === 'CONTENT_FILTERED') {
                            throw new Error('CONTENT_FILTERED');
                          }
                          let base64Data = null;
                          if (finishReason === 'CONTENT_FILTERED') {
                            throw new Error('CONTENT_FILTERED');
                          }
                          if (response_body.image) {
                            base64Data = response_body.image.startsWith('data:')
                              ? response_body.image
                              : `data:image/jpeg;base64,${response_body.image}`;
                          } else if (response_body.artifacts && response_body.artifacts[0]?.base64) {
                            base64Data = response_body.artifacts[0].base64.startsWith('data:')
                              ? response_body.artifacts[0].base64
                              : `data:image/jpeg;base64,${response_body.artifacts[0].base64}`;
                          } else if (response_body.images && response_body.images[0]) {
                            base64Data = response_body.images[0].startsWith('data:')
                              ? response_body.images[0]
                              : `data:image/jpeg;base64,${response_body.images[0]}`;
                          }
                          if (base64Data) {
                            updateForm('avatar', base64Data);
                            updateForm('lastUsedPrompt', finalPrompt);
                          } else {
                            throw new Error('No image data in response. Keys: ' + Object.keys(response_body).join(', '));
                          }
                        } catch (e) {
                          const errorMsg = e instanceof Error ? e.message : 'Unknown error';
                          let userMsg = 'Failed to generate avatar. Try a different prompt.';
                          
                          if (errorMsg.includes('CONTENT_FILTERED')) {
                            userMsg = 'Content filtered by NVIDIA. Try a different description or model.';
                          }
                          
                          toast({
                            variant: 'destructive',
                            title: 'Image generation failed',
                            description: userMsg,
                          });
                        } finally {
                          setGenerating(false);
                        }
                      }}
                      disabled={generating || !form.name}
                    >
                      {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-sm">Custom Avatar Prompt</Label>
                  <Checkbox
                    checked={form.useCustomAvatarPrompt || false}
                    onCheckedChange={(v) => updateForm('useCustomAvatarPrompt', !!v)}
                  />
                </div>
                <p className="text-xs text-muted-foreground mb-1">Check to use your custom prompt instead of auto-generated one</p>
                <div className="relative">
                  <Textarea
                    value={form.customAvatarPrompt || ''}
                    onChange={(e) => updateForm('customAvatarPrompt', e.target.value)}
                    placeholder="Custom prompt for AI image generation (e.g., anime style portrait, cyberpunk character...)"
                    className="min-h-[80px] pr-10"
                    maxLength={1000}
                    disabled={!form.useCustomAvatarPrompt}
                  />
                  {form.useCustomAvatarPrompt && (form.customAvatarPrompt || '').length > 0 && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-foreground"
                            disabled={enhancingPrompt}
                            onClick={async () => {
                              const currentPrompt = form.customAvatarPrompt || '';
                              if (!currentPrompt.trim()) return;
                              setEnhancingPrompt(true);
                              try {
                                const imageModel = settingsStore.settings.nvidiaImageModel || 'stabilityai/stable-diffusion-3-medium';
                                const maxLen = imageModel.includes('flux') ? 790
                                  : imageModel.includes('stable-diffusion-3') ? 400
                                  : imageModel.includes('stable-diffusion-xl') ? 300
                                  : 400;
                                const enhanced = await enhanceCustomAvatarPrompt(settingsStore.settings, currentPrompt, {
                                  model: imageModel.split('/').pop() || imageModel,
                                  maxChars: maxLen,
                                });
                                // Safety truncation — AI should already respect the limit
                                const truncated = enhanced.length > maxLen ? enhanced.slice(0, maxLen) : enhanced;
                                updateForm('customAvatarPrompt', truncated);
                                if (truncated.length < enhanced.length) {
                                  setGenerationError(`Prompt truncated from ${enhanced.length} to ${maxLen} chars to fit ${imageModel.split('/').pop()} limits`);
                                }
                              } catch {
                                // keep original on error
                              } finally {
                                setEnhancingPrompt(false);
                              }
                            }}
                          >
                            {enhancingPrompt ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <Sparkles className="w-4 h-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Enhance prompt with AI</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                {form.lastUsedPrompt && (
                  <div className="mt-2 p-2 bg-muted rounded text-xs">
                    <p className="font-medium mb-1">Last used prompt:</p>
                    <p className="text-muted-foreground">{form.lastUsedPrompt}</p>
                  </div>
                )}
              </div>
              <div>
                <Label className="text-sm">Description *</Label>
                <p className="text-xs text-muted-foreground mb-1">Physical appearance, background, who they are</p>
                <Textarea
                  value={form.description || ''}
                  onChange={(e) => updateForm('description', e.target.value)}
                  placeholder="A young woman with long silver hair and piercing blue eyes. She is a wandering mage..."
                  className="min-h-[120px]"
                  maxLength={5000}
                />
              </div>
              <div>
                <Label className="text-sm">Tags</Label>
                <div className="flex flex-wrap gap-1 mt-1 mb-1">
                  {(form.tags || []).map(tag => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      {tag}
                      <button 
                        onClick={() => removeTag(tag)} 
                        className="hover:text-destructive"
                        type="button"
                        aria-label={`Remove tag ${tag}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    placeholder="Add tag..."
                    className="h-8 text-sm"
                    maxLength={30}
                  />
                  <Button variant="outline" size="sm" onClick={addTag} type="button">
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
                  onChange={(e) => updateForm('personality', e.target.value)}
                  placeholder="Kind but reserved, slow to trust. Has a dry sense of humor..."
                  className="min-h-[100px]"
                  maxLength={3000}
                />
              </div>
              <div>
                <Label className="text-sm">Speech Patterns</Label>
                <p className="text-xs text-muted-foreground mb-1">How they talk (accent, vocabulary, verbal habits)</p>
                <Textarea
                  value={form.speechPatterns || ''}
                  onChange={(e) => updateForm('speechPatterns', e.target.value)}
                  placeholder="Speaks formally, occasionally uses archaic phrases..."
                  className="min-h-[80px]"
                  maxLength={2000}
                />
              </div>
              <div>
                <Label className="text-sm">Likes</Label>
                <Textarea
                  value={form.likes || ''}
                  onChange={(e) => updateForm('likes', e.target.value)}
                  placeholder="Things they enjoy"
                  className="min-h-[60px]"
                  maxLength={1000}
                />
              </div>
              <div>
                <Label className="text-sm">Dislikes</Label>
                <Textarea
                  value={form.dislikes || ''}
                  onChange={(e) => updateForm('dislikes', e.target.value)}
                  placeholder="Things they hate"
                  className="min-h-[60px]"
                  maxLength={1000}
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
                  onChange={(e) => updateForm('scenario', e.target.value)}
                  placeholder="A medieval fantasy world where magic is dying. The character runs a small bookshop..."
                  className="min-h-[100px]"
                  maxLength={3000}
                />
              </div>
              <div>
                <Label className="text-sm">Relationship to User</Label>
                <Textarea
                  value={form.relationship || ''}
                  onChange={(e) => updateForm('relationship', e.target.value)}
                  placeholder="Strangers who just met at a tavern..."
                  className="min-h-[60px]"
                  maxLength={1000}
                />
              </div>
              <div>
                <Label className="text-sm">First Message *</Label>
                <p className="text-xs text-muted-foreground mb-1">The character&apos;s opening greeting</p>
                <Textarea
                  value={form.firstMessage || ''}
                  onChange={(e) => updateForm('firstMessage', e.target.value)}
                  placeholder="*The bell above the door chimes as you enter the bookshop* Oh, hello there..."
                  className="min-h-[120px]"
                  maxLength={5000}
                />
              </div>
              <div>
                <Label className="text-sm">Example Dialogue</Label>
                <p className="text-xs text-muted-foreground mb-1">Example messages (Character.ai format: &lt;START&gt;)</p>
                <Textarea
                  value={form.exampleMessages || ''}
                  onChange={(e) => updateForm('exampleMessages', e.target.value)}
                  placeholder={`<START>\n{{user}}: Hello!\n{{char}}: *smiles warmly* Welcome, traveler.`}
                  className="min-h-[120px] font-mono text-xs"
                  maxLength={5000}
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
                  onChange={(e) => updateForm('knowledge', e.target.value)}
                  placeholder="Knows ancient elvish, skilled in potion-making..."
                  className="min-h-[80px]"
                  maxLength={3000}
                />
              </div>
              <div>
                <Label className="text-sm">Behavioral Guidelines</Label>
                <p className="text-xs text-muted-foreground mb-1">How the character should behave in the roleplay</p>
                <Textarea
                  value={form.behavior || ''}
                  onChange={(e) => updateForm('behavior', e.target.value)}
                  placeholder="Always maintain mystery. Never reveal full backstory at once..."
                  className="min-h-[80px]"
                  maxLength={3000}
                />
              </div>
              <div>
                <Label className="text-sm">Custom System Prompt (Override)</Label>
                <p className="text-xs text-muted-foreground mb-1">Replaces auto-generated system prompt entirely</p>
                <Textarea
                  value={form.systemPrompt || ''}
                  onChange={(e) => updateForm('systemPrompt', e.target.value)}
                  placeholder="Write {{char}}'s entire system prompt here..."
                  className="min-h-[120px]"
                  maxLength={10000}
                />
              </div>
              <div>
                <Label className="text-sm">Creator Notes</Label>
                <Textarea
                  value={form.creatorNotes || ''}
                  onChange={(e) => updateForm('creatorNotes', e.target.value)}
                  placeholder="Private notes about this character..."
                  className="min-h-[60px]"
                  maxLength={2000}
                />
              </div>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-border flex justify-end gap-2 flex-shrink-0">
        {isEditing && initialCharacter && (
          <Button
            variant="destructive"
            size="sm"
            onClick={async () => {
              const confirmed = await showConfirm({
                title: `Delete "${initialCharacter.name}"?`,
                description: 'This cannot be undone.',
                confirmText: 'Delete',
                destructive: true,
              });
              if (confirmed) {
                store.deleteCharacter(initialCharacter.id);
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
  const { showConfirm } = useConfirmDialog();
  const [search, setSearch] = useState('');
  const [showFavorites, setShowFavorites] = useState(false);

  const filtered = useMemo(() => {
    let chars = store.characters;
    if (showFavorites) chars = chars.filter(c => c.isFavorite);
    if (search) {
      const lowerSearch = search.toLowerCase();
      chars = chars.filter(c =>
        c.name.toLowerCase().includes(lowerSearch) ||
        c.tags?.some(t => t.toLowerCase().includes(lowerSearch))
      );
    }
    return chars;
  }, [store.characters, search, showFavorites]);

  const activeCharacter = store.activeCharacter;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[300px] max-w-[85vw] p-0">
        <SheetHeader className="p-4 pb-3 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" /> RolePlay Chat
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100dvh-10rem)] overflow-y-auto -webkit-overflow-scrolling-touch">
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
                <p className="text-center text-muted-foreground text-xs py-4">
                  {showFavorites ? 'No favorites yet' : 'No characters yet'}
                </p>
              )}
              {filtered.map(char => (
                <div
                  key={char.id}
                  className="flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors min-w-0 hover:bg-muted/50"
                  onClick={() => { store.selectCharacter(char); onOpenChange(false); }}
                  style={{ minWidth: 0 }}
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {char.avatar ? (
                      <img src={char.avatar} alt={char.name} className="w-full h-full object-cover" />
                    ) : (
                      <Bot className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <p className="text-sm font-medium truncate">{char.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {char.tags?.slice(0, 2).join(', ') || 'No tags'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {char.isFavorite && (
                      <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        store.setCharacterEditorOpen(true, char);
                      }}
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={async (e) => {
                        e.stopPropagation();
                        const confirmed = await showConfirm({
                          title: `Delete "${char.name}"?`,
                          description: 'This cannot be undone.',
                          confirmText: 'Delete',
                          destructive: true,
                        });
                        if (confirmed) {
                          store.deleteCharacter(char.id);
                        }
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chat History Section */}
          {activeCharacter && (
            <div>
              <div className="p-3 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-semibold truncate">Chats with {activeCharacter.name}</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 flex-shrink-0"
                  onClick={() => { store.newChat(activeCharacter); onOpenChange(false); }}
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
                    className="flex items-center gap-1.5 px-2.5 py-2.5 rounded-lg cursor-pointer text-sm transition-colors min-w-0 hover:bg-muted/50"
                    onClick={() => { store.selectChat(chat); onOpenChange(false); }}
                    style={{ minWidth: 0 }}
                  >
                    <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
                    <span className="truncate flex-1 min-w-0" style={{ minWidth: 0 }}>{chat.title}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={async (e) => {
                        e.stopPropagation();
                        const confirmed = await showConfirm({
                          title: 'Delete this chat?',
                          description: 'This cannot be undone.',
                          confirmText: 'Delete',
                          destructive: true,
                        });
                        if (confirmed) {
                          store.deleteChat(chat.id);
                        }
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
  const memories = store.memories;

  const getMemoryTypeColor = useCallback((type: string) => {
    switch (type) {
      case 'fact': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'event': return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
      case 'emotion': return 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20';
      case 'preference': return 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20';
      case 'instruction': return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20';
      default: return 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20';
    }
  }, []);

  const formatRelativeTime = useCallback((timestamp: number) => {
    const diff = Date.now() - timestamp;
    if (diff < 0) return 'Just now';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
  }, []);

  const memoriesByType = useMemo(() => {
    return memories.reduce<Record<string, number>>((acc, mem) => {
      const type = mem.type || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
  }, [memories]);

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
          {memories.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                <p className="text-2xl font-bold">{memories.length}</p>
                <p className="text-xs text-muted-foreground">Total Memories</p>
              </div>
              <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/10">
                <p className="text-2xl font-bold">
                  {memories.filter(m => m.accessCount > 2).length}
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
          <ScrollArea className="flex-1 -mx-6 px-6 overflow-y-auto touch-pan-y">
            <div className="space-y-2 pb-4">
              {memories.length === 0 ? (
                <div className="text-center py-12">
                  <Brain className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-sm font-medium text-muted-foreground">No memories yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Memories are automatically extracted as you chat
                  </p>
                </div>
              ) : (
                memories.map(mem => (
                  <div 
                    key={mem.id} 
                    className="p-3 rounded-lg bg-muted/30 border border-transparent hover:border-border/50 transition-colors space-y-2 group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Badge variant="outline" className={`text-[10px] h-5 ${getMemoryTypeColor(mem.type || 'unknown')}`}>
                        {mem.type || 'unknown'}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => store.deleteMemory(mem.id)}
                        aria-label="Delete memory"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    <p className="text-sm leading-relaxed break-words">{mem.content}</p>
                    {mem.keywords && mem.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {mem.keywords.slice(0, 5).map(kw => (
                          <span key={kw} className="text-[10px] text-muted-foreground bg-background/50 px-1.5 py-0.5 rounded">
                            #{kw}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{formatRelativeTime(mem.timestamp)}</span>
                      <div className="flex items-center gap-2">
                        <span>{mem.accessCount} refs</span>
                        <span className="text-yellow-500/70">
                          {'★'.repeat(Math.min(Math.ceil((mem.importance || 0) / 2), 5))}
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