'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useChatStore } from '@/stores/chat-store';
import { useSettingsStore } from '@/stores/settings-store';
import { getModelsForProvider, generateCharacter, enhanceImagePrompt, enhanceTextPrompt } from '@/lib/ai-engine';
import type { Character, AIProvider, CharacterTemplate } from '@/lib/types';
import { CHARACTER_TEMPLATES } from '@/lib/types';
import { exportAllData, importAllData, clearAllData, settingsDB } from '@/lib/db';
import {
  MessageSquare, Plus, Settings, Brain, Trash2, Star, Send, Square,
  ChevronLeft, ChevronRight, Pencil, Download, Upload, X, Bot,
  AlertCircle, RefreshCw, Search, Sparkles, Shield, RotateCcw,
  Eye, EyeOff, Zap, BookOpen, Menu
} from 'lucide-react';
import { useIsMobile, useMobileOptimizations } from '@/hooks/use-mobile';
import { useContextMenuStore, ContextMenu } from '@/hooks/use-context-menu';
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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { ThemeToggle } from '@/components/theme-toggle';

// ============================================================
// TYPES
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

  useMobileOptimizations();

  // Global listeners for context menu
  useEffect(() => {
    const handleClick = () => contextMenu.hide();
    const handleScroll = () => contextMenu.hide();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        contextMenu.hide();
        setLightboxImage(null);
      }
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
    const init = async () => {
      await Promise.all([store.loadCharacters(), settingsStore.loadSettings()]);
      setMounted(true);
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      {!isMobile && store.activeCharacter && <ChatHistorySidebar />}

      {/* Mobile Nav Sheet */}
      {isMobile && (
        <MobileNavSheet open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
      )}

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {store.activeCharacter && store.activeChat ? (
          <ChatView
            isMobile={isMobile}
            onOpenMobileNav={() => setMobileNavOpen(true)}
            lightboxImage={lightboxImage}
            setLightboxImage={setLightboxImage}
          />
        ) : store.activeCharacter ? (
          <EmptyChatView
            isMobile={isMobile}
            onOpenMobileNav={() => setMobileNavOpen(true)}
            lightboxImage={lightboxImage}
            setLightboxImage={setLightboxImage}
          />
        ) : (
          <WelcomeView isMobile={isMobile} onOpenMobileNav={() => setMobileNavOpen(true)} />
        )}
      </main>

      {/* Dialogs rendered at root level to avoid z-index / portal issues */}
      <SettingsDialog />
      <CharacterEditorDialog />
      <MemoryPanelSheet />
      <SetupWizard />

      {/* Global Context Menu */}
      <ContextMenu
        state={{
          visible: contextMenu.visible,
          x: contextMenu.x,
          y: contextMenu.y,
          items: contextMenu.items,
        }}
      />

      {/* Image Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setLightboxImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300 p-2 z-10"
            onClick={() => setLightboxImage(null)}
            aria-label="Close lightbox"
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
// SETUP WIZARD
// ============================================================
function SetupWizard() {
  const settingsStore = useSettingsStore();
  const store = useChatStore();
  const [step, setStep] = useState(0);
  const [userName, setUserName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<CharacterTemplate | null>(null);
  const [charName, setCharName] = useState('');

  const showWizard = settingsStore.isLoaded && settingsStore.settings.showSetupWizard;

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
    { title: 'Welcome!', description: "Let's set up your roleplay experience in just a few steps." },
    { title: 'Your Name', description: 'What should the AI characters call you?' },
    { title: 'Quick Start', description: 'Choose a template or create your own character.' },
  ];

  return (
    // BUG FIX: onOpenChange must not be a no-op — prevent closing via backdrop but allow ESC
    <Dialog open={true} onOpenChange={(open) => { if (!open) handleComplete(); }}>
      <DialogContent
        className="max-w-lg p-0 gap-0"
        aria-describedby="wizard-description"
        // BUG FIX: prevent accidental dismissal by clicking outside
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogDescription id="wizard-description" className="sr-only">
          Setup wizard for configuring your AI assistant
        </DialogDescription>
        <div className="flex gap-1 p-4 pb-0">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? 'bg-primary' : 'bg-muted'}`}
            />
          ))}
        </div>

        <div className="p-6 pt-4">
          <h2 className="text-xl font-bold mb-2">{steps[step].title}</h2>
          <p className="text-muted-foreground text-sm mb-6">{steps[step].description}</p>

          {step === 0 && (
            <div className="space-y-4">
              {[
                { icon: <Shield className="w-4 h-4 text-green-500" />, title: 'Privacy First', desc: 'All your data stays on your device. No servers, no tracking, no accounts.' },
                { icon: <Brain className="w-4 h-4 text-blue-500" />, title: 'AI-Powered', desc: 'Bring characters to life with AI. Supports Groq (free!), OpenAI, Anthropic, and more.' },
                { icon: <Sparkles className="w-4 h-4 text-purple-500" />, title: 'Memory', desc: 'Characters remember your conversations and learn about you over time.' },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="p-4 rounded-lg bg-muted/50 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">{icon}{title}</div>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          )}

          {step === 1 && (
            <div>
              <Label htmlFor="userName" className="text-sm">Your Name</Label>
              <Input
                id="userName"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Enter your name..."
                className="mt-1.5"
                maxLength={50}
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-1">
                Characters will use this name when talking to you.
              </p>
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
                      <div className="text-[10px] text-muted-foreground truncate">{template.description}</div>
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

          <div className="flex justify-between mt-6">
            {step > 0 ? (
              <Button variant="outline" onClick={() => setStep((s) => s - 1)}>Back</Button>
            ) : (
              <Button variant="outline" onClick={handleComplete}>Skip Setup</Button>
            )}
            {step < steps.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)}>Next</Button>
            ) : (
              <Button onClick={handleComplete} disabled={!!selectedTemplate && !charName.trim()}>
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
// WELCOME VIEW
// ============================================================
function WelcomeView({
  isMobile,
  onOpenMobileNav,
}: {
  isMobile: boolean;
  onOpenMobileNav: () => void;
}) {
  const store = useChatStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const text = ev.target?.result as string;
        if (!text?.trim()) return;
        try {
          const character = await store.importCharacter(text);
          if (character) store.selectCharacter(character);
        } catch {
          toast({ variant: 'destructive', title: 'Import failed', description: 'Invalid character file.' });
        }
      };
      reader.readAsText(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [store, toast]
  );

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {isMobile && (
        <div className="h-12 border-b border-border flex items-center px-3 gap-2 bg-card flex-shrink-0">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onOpenMobileNav}>
            <Menu className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold text-sm flex-1">RolePlay Chat</h1>
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
            <p className="text-muted-foreground text-sm sm:text-base">
              Private, intelligent roleplay with any AI model. Your data stays on your device.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:gap-4 text-center">
            {[
              { icon: <Shield className="w-4 h-4 sm:w-5 sm:h-5 mx-auto mb-1 text-green-500" />, label: '100% Private' },
              { icon: <Zap className="w-4 h-4 sm:w-5 sm:h-5 mx-auto mb-1 text-yellow-500" />, label: 'BYOK Multi-Provider' },
              { icon: <Brain className="w-4 h-4 sm:w-5 sm:h-5 mx-auto mb-1 text-purple-500" />, label: 'Smart Memory' },
            ].map(({ icon, label }) => (
              <div key={label} className="p-2.5 sm:p-3 rounded-xl bg-muted/50">
                {icon}
                <p className="text-[10px] sm:text-xs font-medium">{label}</p>
              </div>
            ))}
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
                {isMobile ? 'Or tap the menu to see your characters' : 'Or select a character from the sidebar →'}
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
// EMPTY CHAT VIEW
// ============================================================
function EmptyChatView({
  isMobile,
  onOpenMobileNav,
  setLightboxImage,
}: {
  isMobile: boolean;
  onOpenMobileNav: () => void;
  lightboxImage: string | null;
  setLightboxImage: (img: string | null) => void;
}) {
  const store = useChatStore();
  if (!store.activeCharacter) return null;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {isMobile && (
        <div className="h-12 border-b border-border flex items-center px-3 gap-2 bg-card flex-shrink-0">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onOpenMobileNav}>
            <Menu className="w-5 h-5" />
          </Button>
          <CharacterAvatar character={store.activeCharacter} size="sm" />
          <h2 className="font-semibold text-sm truncate flex-1">{store.activeCharacter.name}</h2>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => store.setSettingsOpen(true)}>
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      )}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto">
        <div className="text-center space-y-4 max-w-md w-full">
          <button
            className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full flex items-center justify-center mx-auto overflow-hidden cursor-zoom-in"
            onClick={() => store.activeCharacter?.avatar && setLightboxImage(store.activeCharacter.avatar)}
            aria-label="View avatar"
          >
            {store.activeCharacter.avatar ? (
              <img src={store.activeCharacter.avatar} alt={store.activeCharacter.name} className="w-full h-full object-cover" />
            ) : (
              <Bot className="w-10 h-10 sm:w-12 sm:h-12 text-primary" />
            )}
          </button>
          <h2 className="text-xl sm:text-2xl font-bold">{store.activeCharacter.name}</h2>
          {store.activeCharacter.description && (
            <p className="text-muted-foreground text-sm line-clamp-3">{store.activeCharacter.description}</p>
          )}
          <Button
            size="lg"
            className="gap-2 min-h-[44px]"
            onClick={() => store.activeCharacter && store.newChat(store.activeCharacter)}
          >
            <MessageSquare className="w-5 h-5" /> Start Chat
          </Button>
          {store.chats.length > 0 && (
            <div className="pt-4 space-y-2 w-full">
              <p className="text-sm text-muted-foreground font-medium">Recent Chats</p>
              {store.chats.slice(0, 3).map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => store.selectChat(chat)}
                  className="flex items-center justify-between w-full text-left px-4 py-2.5 rounded-lg hover:bg-muted text-sm min-h-[44px]"
                >
                  <span className="truncate">{chat.title}</span>
                  <span className="text-muted-foreground text-xs ml-2 shrink-0">({chat.messageCount} msgs)</span>
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
// SHARED: CHARACTER AVATAR
// ============================================================
function CharacterAvatar({ character, size = 'md', onClick }: { character: Character; size?: 'sm' | 'md' | 'lg'; onClick?: () => void }) {
  const sizeMap = { sm: 'w-8 h-8', md: 'w-9 h-9', lg: 'w-20 h-20 sm:w-24 sm:h-24' };
  const iconMap = { sm: 'w-4 h-4', md: 'w-4 h-4', lg: 'w-10 h-10 sm:w-12 sm:h-12' };
  return (
    <div
      className={`${sizeMap[size]} rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden ${onClick ? 'cursor-zoom-in' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      aria-label={onClick ? `View ${character.name}'s avatar` : undefined}
    >
      {character.avatar ? (
        <img src={character.avatar} alt={character.name} className="w-full h-full object-cover" />
      ) : (
        <Bot className={iconMap[size]} />
      )}
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
    if (showFavorites) chars = chars.filter((c) => c.isFavorite);
    if (search) {
      const lower = search.toLowerCase();
      chars = chars.filter(
        (c) => c.name.toLowerCase().includes(lower) || c.tags?.some((t) => t.toLowerCase().includes(lower))
      );
    }
    return chars;
  }, [store.characters, search, showFavorites]);

  if (!store.sidebarOpen) {
    return (
      <div className="w-10 border-r border-border bg-card flex flex-col items-center py-3 gap-3 flex-shrink-0">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => store.setSidebarOpen(true)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Open sidebar</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  return (
    <div className="w-56 sm:w-64 border-r border-border bg-card flex flex-col overflow-hidden flex-shrink-0">
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
        <Button
          variant={showFavorites ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 text-xs w-full"
          onClick={() => setShowFavorites(!showFavorites)}
        >
          <Star className="w-3 h-3 mr-1" /> Favorites
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-1">
          {filtered.length === 0 && (
            <div className="text-center text-muted-foreground py-8 space-y-3">
              <p className="text-xs">{showFavorites ? 'No favorites yet' : 'No characters yet'}</p>
              {!showFavorites && (
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => store.setCharacterEditorOpen(true)}>
                  Create your first character
                </Button>
              )}
            </div>
          )}
          {filtered.map((char) => (
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
  const { showConfirm } = useConfirmDialog();

  useEffect(() => {
    return () => {
      if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    };
  }, []);

  const getMenuItems = useCallback(() => [
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
        if (confirmed) store.deleteCharacter(character.id);
      },
    },
  ], [character, store, showConfirm]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      contextMenu.show(e, getMenuItems());
    },
    [contextMenu, getMenuItems]
  );

  // BUG FIX: Long-press on mobile instead of double-tap for context menu
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;
      touchTimerRef.current = setTimeout(() => {
        handleContextMenu(e);
      }, 600);
    },
    [handleContextMenu]
  );

  const handleTouchEnd = useCallback(() => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  }, []);

  return (
    <div
      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
        store.activeCharacter?.id === character.id ? 'bg-muted' : ''
      }`}
      onClick={() => store.selectCharacter(character)}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
    >
      <CharacterAvatar character={character} size="md" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{character.name}</p>
        <p className="text-xs text-muted-foreground truncate">{character.tags?.slice(0, 2).join(', ') || 'No tags'}</p>
      </div>
      <div className="flex gap-0.5 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground"
          onClick={(e) => { e.stopPropagation(); store.setCharacterEditorOpen(true, character); }}
          aria-label="Edit character"
        >
          <Pencil className="w-3 h-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground"
          onClick={(e) => { e.stopPropagation(); store.saveCharacter({ ...character, isFavorite: !character.isFavorite }); }}
          aria-label={character.isFavorite ? 'Unfavorite' : 'Favorite'}
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
            if (confirmed) store.deleteCharacter(character.id);
          }}
          aria-label="Delete character"
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
                  onClick={() => store.activeCharacter && store.newChat(store.activeCharacter)}
                  aria-label="New chat"
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>New Chat</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-0.5">
          {store.chats.length === 0 && (
            <div className="text-center text-muted-foreground py-8 space-y-3">
              <p className="text-xs">No chats yet</p>
              <Button variant="outline" size="sm" className="text-xs h-7" disabled={!store.activeCharacter} onClick={() => store.activeCharacter && store.newChat(store.activeCharacter)}>
                Start a new chat
              </Button>
            </div>
          )}
          {store.chats.map((chat) => (
            // BUG FIX: Added group class so hover opacity on delete button works
            <div
              key={chat.id}
              className={`group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors min-w-0 ${
                store.activeChat?.id === chat.id ? 'bg-muted' : 'hover:bg-muted/50'
              }`}
              onClick={() => store.selectChat(chat)}
            >
              <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
              <span className="truncate flex-1 min-w-0">{chat.title}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                onClick={async (e) => {
                  e.stopPropagation();
                  const confirmed = await showConfirm({
                    title: 'Delete this chat?',
                    description: 'This cannot be undone.',
                    confirmText: 'Delete',
                    destructive: true,
                  });
                  if (confirmed) store.deleteChat(chat.id);
                }}
                aria-label="Delete chat"
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
function ChatView({
  isMobile,
  onOpenMobileNav,
  lightboxImage,
  setLightboxImage,
}: {
  isMobile: boolean;
  onOpenMobileNav: () => void;
  lightboxImage: string | null;
  setLightboxImage: (img: string | null) => void;
}) {
  const store = useChatStore();
  const { showConfirm } = useConfirmDialog();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAutoScrollRef = useRef(true);

  const messages = store.messages;
  const activeCharacter = store.activeCharacter;
  const activeChat = store.activeChat;

  useEffect(() => {
    if (isAutoScrollRef.current) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      });
    }
  }, [messages]);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    isAutoScrollRef.current = scrollHeight - scrollTop - clientHeight < 100;
  }, []);

  if (!activeCharacter || !activeChat) return null;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
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
        <CharacterAvatar character={activeCharacter} size="sm" onClick={() => activeCharacter.avatar && setLightboxImage(activeCharacter.avatar)} />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-sm truncate">{activeCharacter.name}</h2>
          {!isMobile && <p className="text-xs text-muted-foreground truncate">{activeChat.title}</p>}
        </div>
        <div className="flex gap-1 items-center">
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
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:text-destructive"
                      onClick={async () => {
                        const confirmed = await showConfirm({
                          title: 'Delete this chat?',
                          description: 'This cannot be undone.',
                          confirmText: 'Delete',
                          destructive: true,
                        });
                        if (confirmed) store.deleteChat(activeChat.id);
                      }}
                    >
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
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto" onScroll={handleScroll}>
        <div className={`mx-auto p-4 space-y-4 ${isMobile ? 'max-w-full' : 'max-w-3xl'}`}>
          {messages.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">Start a conversation with {activeCharacter.name}</p>
            </div>
          )}
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={{
                id: msg.id,
                role: msg.role,
                content: msg.content,
                isStreaming: msg.isStreaming,
                timestamp: msg.timestamp,
                image: msg.metadata?.image,
                lightboxImage,
                setLightboxImage,
              }}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <ChatInput />
    </div>
  );
}

// ============================================================
// MESSAGE BUBBLE
// ============================================================
function MessageBubble({ message }: { message: MessageData }) {
  const store = useChatStore();
  const contextMenu = useContextMenuStore();
  const { showConfirm } = useConfirmDialog();
  const { toast } = useToast();
  const isUser = message.role === 'user';
  const lastTouchTimeRef = useRef<number>(0);

  const copyToClipboard = useCallback(
    (text: string) => {
      navigator.clipboard.writeText(text).then(
        () => toast({ title: 'Copied!' }),
        () => {
          // Fallback
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          try { document.execCommand('copy'); } catch {}
          document.body.removeChild(ta);
        }
      );
    },
    [toast]
  );

  const getMenuItems = useCallback(() => {
    const items: any[] = [
      {
        label: 'Copy Text',
        icon: <CopyIcon className="w-4 h-4" />,
        onClick: () => copyToClipboard(message.content),
      },
    ];
    if (!isUser && !message.isStreaming) {
      items.push({ label: 'Regenerate', icon: <RefreshCw className="w-4 h-4" />, onClick: () => store.regenerateMessage() });
    }
    items.push({
      label: 'Delete',
      icon: <Trash2 className="w-4 h-4" />,
      destructive: true,
      onClick: async () => {
        const confirmed = await showConfirm({
          title: 'Delete this message?',
          description: 'This cannot be undone.',
          confirmText: 'Delete',
          destructive: true,
        });
        if (confirmed) store.deleteMessage(message.id);
      },
    });
    return items;
  }, [message, isUser, store, showConfirm, copyToClipboard]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!message.content) return;
      e.preventDefault();
      e.stopPropagation();
      contextMenu.show(e, getMenuItems());
    },
    [contextMenu, getMenuItems, message.content]
  );

  // BUG FIX: double-tap detection — use touchend not touchstart to avoid fire on scroll
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const now = Date.now();
      const diff = now - lastTouchTimeRef.current;
      lastTouchTimeRef.current = now;
      if (diff < 400 && diff > 0) handleContextMenu(e);
    },
    [handleContextMenu]
  );

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className="group relative max-w-[85%] sm:max-w-[75%]"
        onContextMenu={handleContextMenu}
        onTouchEnd={handleTouchEnd}
      >
        {!isUser && store.activeCharacter && (
          <div className="flex items-center gap-1.5 mb-1 ml-1">
            <CharacterAvatar
              character={store.activeCharacter}
              size="sm"
              onClick={() => store.activeCharacter?.avatar && message.setLightboxImage?.(store.activeCharacter.avatar)}
            />
            <span className="text-xs font-medium text-muted-foreground">{store.activeCharacter.name}</span>
          </div>
        )}
        {message.image && (
          <div className="mt-2 rounded-lg overflow-hidden">
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
            isUser ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-muted rounded-tl-sm'
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
          <span className="text-[10px] text-muted-foreground/60 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {message.content && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground/60 hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
              onClick={() => copyToClipboard(message.content)}
              aria-label="Copy message"
            >
              <CopyIcon className="w-3.5 h-3.5" />
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

function formatMessageContent(content: string): React.ReactNode {
  if (!content) return null;
  const tokens: Array<{ type: 'bold' | 'action' | 'dialogue' | 'text'; content: string }> = [];
  let remaining = content;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
    if (boldMatch) { tokens.push({ type: 'bold', content: boldMatch[1] }); remaining = remaining.slice(boldMatch[0].length); continue; }

    const actionMatch = remaining.match(/^\*([a-z][^*]+)\*/);
    if (actionMatch) { tokens.push({ type: 'action', content: actionMatch[1] }); remaining = remaining.slice(actionMatch[0].length); continue; }

    const dialogueMatch = remaining.match(/^"([^"]+)"/);
    if (dialogueMatch) { tokens.push({ type: 'dialogue', content: dialogueMatch[1] }); remaining = remaining.slice(dialogueMatch[0].length); continue; }

    const nextSpecials = [remaining.indexOf('*'), remaining.indexOf('"')].filter((i) => i !== -1);
    const next = nextSpecials.length ? Math.min(...nextSpecials) : -1;

    if (next === -1) { tokens.push({ type: 'text', content: remaining }); remaining = ''; }
    else if (next === 0) { tokens.push({ type: 'text', content: remaining[0] }); remaining = remaining.slice(1); }
    else { tokens.push({ type: 'text', content: remaining.slice(0, next) }); remaining = remaining.slice(next); }
  }

  return tokens.map((token, i) => {
    if (!token.content) return null;
    switch (token.type) {
      case 'bold': return <strong key={i}>{token.content}</strong>;
      case 'action': return <em key={i} className="text-muted-foreground">*{token.content}*</em>;
      case 'dialogue': return <span key={i} className="font-medium">&ldquo;{token.content}&rdquo;</span>;
      default: return <span key={i}>{token.content}</span>;
    }
  });
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
  const settings = settingsStore.settings;
  const activeChatId = store.activeChat?.id;
  const models = useMemo(() => getModelsForProvider(settings.activeProvider), [settings.activeProvider]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || store.isStreaming) return;
    store.sendMessage(trimmed);
    setText('');
    requestAnimationFrame(() => {
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    });
  }, [text, store]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey && settings.sendOnEnter) {
        e.preventDefault();
        handleSend();
      }
    },
    [settings.sendOnEnter, handleSend]
  );

  const handleInput = useCallback(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
    }
  }, []);

  useEffect(() => {
    if (!activeChatId) return;
    const timer = setTimeout(() => textareaRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, [activeChatId]);

  const handleGenerateImage = useCallback(async () => {
    if (!store.activeCharacter || generatingImage) return;
    const nvidiaConfig = settings.providers.find((p) => p.provider === 'nvidia');
    if (!nvidiaConfig?.apiKey) return;

    setGeneratingImage(true);
    try {
      const charName = store.activeCharacter.name;
      const charDesc = store.activeCharacter.description || '';
      const charPersonality = store.activeCharacter.personality || '';
      const recentContext = store.messages.slice(-6).find((m) => m.role === 'user' || m.role === 'assistant')?.content.slice(0, 150) || '';

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
      if (recentContext) basePrompt += `, scene: ${recentContext}`;

      let finalPrompt = basePrompt.slice(0, 800);
      if (settings.enhanceImagePrompts) {
        try {
          finalPrompt = (await enhanceImagePrompt(settingsStore.settings, finalPrompt, `Character: ${charName}. Scene: ${recentContext}`)).slice(0, 800);
        } catch {
          finalPrompt = basePrompt.slice(0, 800);
        }
      }

      const response = await fetch('https://roleplay.jameskaren.workers.dev/v1/genai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: finalPrompt,
          model: imageModel,
          cfg_scale: defaults.cfg_scale,
          aspect_ratio: '16:9',
          seed: Math.floor(Math.random() * 1000000),
          steps: defaults.steps,
          negative_prompt: imageModel.includes('flux') ? undefined : 'cartoon, anime, illustration, drawing, painting, 3d render, deformed, distorted, low quality, blurry, text, watermark',
          apiKey: nvidiaConfig.apiKey,
        }),
      });

      if (!response.ok) { console.error('Image gen failed:', response.status); return; }

      const data = await response.json();
      if (data.artifacts?.[0]?.finishReason === 'CONTENT_FILTERED' || data.artifacts?.[0]?.finish_reason === 'CONTENT_FILTERED') {
        toast({ variant: 'destructive', title: 'Content filtered', description: 'Try a different description or model.' });
        return;
      }

      const raw = data.image || data.artifacts?.[0]?.base64 || data.artifacts?.[0]?.image || data.images?.[0];
      if (raw) {
        const b64 = raw.startsWith('data:') ? raw : `data:image/jpeg;base64,${raw}`;
        await store.addImageMessage(b64, imageModel);
      }
    } catch (e) {
      console.error('Image generation failed:', e);
    } finally {
      setGeneratingImage(false);
    }
  }, [store, settings, settingsStore, generatingImage, toast]);

  return (
    <div className="border-t border-border bg-card p-3 flex-shrink-0">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder={`Message ${store.activeCharacter?.name || '...'}...`}
            className="flex-1 min-h-[44px] max-h-[200px] resize-none rounded-xl text-sm"
            rows={1}
            disabled={store.isStreaming}
            maxLength={10000}
          />
          {store.isStreaming ? (
            <Button variant="destructive" size="icon" className="h-10 w-10 rounded-xl flex-shrink-0" onClick={store.stopStreaming} aria-label="Stop">
              <Square className="w-4 h-4" />
            </Button>
          ) : (
            <Button size="icon" className="h-10 w-10 rounded-xl flex-shrink-0" onClick={handleSend} disabled={!text.trim()} aria-label="Send">
              <Send className="w-4 h-4" />
            </Button>
          )}
        </div>
        <div className="flex items-center justify-between mt-1.5 px-1">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 cursor-pointer hover:bg-accent">
                  {settings.activeModel || 'No model'}
                </Badge>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-64 w-56 overflow-y-auto">
                <DropdownMenuLabel className="text-xs">Switch Model</DropdownMenuLabel>
                {models.map((m) => (
                  <DropdownMenuItem key={m.id} onClick={() => settingsStore.setActiveModel(m.id)} className="text-xs py-1">
                    <span className="truncate">{m.name}</span>
                    {m.id === settings.activeModel && <span className="ml-auto text-muted-foreground text-[10px]">✓</span>}
                  </DropdownMenuItem>
                ))}
                {(settings.activeProvider === 'custom' || settings.activeProvider === 'local') && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        const model = prompt('Enter custom model ID:');
                        if (model?.trim()) settingsStore.setActiveModel(model.trim());
                      }}
                      className="text-xs py-1 text-muted-foreground italic"
                    >
                      + Custom model...
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            {store.messages.length > 0 && (
              <span>{store.messages.length} msgs</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={store.regenerateMessage} disabled={store.isStreaming || store.messages.length < 2} aria-label="Regenerate">
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
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleGenerateImage} disabled={generatingImage || store.isStreaming || !store.activeCharacter} aria-label="Generate image">
                      {generatingImage ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
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
                      if (!lastMsg) return;
                      const confirmed = await showConfirm({ title: 'Delete the last message?', description: 'This cannot be undone.', confirmText: 'Delete', destructive: true });
                      if (confirmed) store.deleteMessage(lastMsg.id);
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
  const [localPreset, setLocalPreset] = useState('ollama');
  const [customModelInput, setCustomModelInput] = useState('');
  const [useCustomModel, setUseCustomModel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const providerList: { id: AIProvider; name: string; icon: string }[] = [
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
    { id: 'llamacpp', name: 'llama.cpp', baseUrl: 'http://localhost:8080/v1', defaultModel: 'model' },
    { id: 'custom', name: 'Custom URL', baseUrl: '', defaultModel: '' },
  ];

  useEffect(() => {
    setUseCustomModel(false);
    setCustomModelInput('');
  }, [settings.activeProvider]);

  const models = useMemo(() => getModelsForProvider(settings.activeProvider), [settings.activeProvider]);

  const handleAddProvider = async () => {
    if (!newProvider) return;
    if (newProvider !== 'local' && !newKey.trim()) return;
    await settingsStore.setProvider({
      provider: newProvider,
      apiKey: newKey.trim() || 'local',
      baseUrl: newBaseUrl || undefined,
      enabled: true,
    });
    await settingsStore.setActiveProvider(newProvider);
    if (newProvider === 'local') {
      const preset = localPresets.find((p) => p.id === localPreset);
      if (preset?.defaultModel) await settingsStore.setActiveModel(preset.defaultModel);
    }
    setNewProvider('');
    setNewKey('');
    setNewBaseUrl('');
  };

  const handleExportData = async () => {
    try {
      const data = await exportAllData();
      const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: `roleplay-chat-backup-${new Date().toISOString().split('T')[0]}.json` });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      showAlert({ title: 'Export Failed', description: 'Failed to export data.', variant: 'error' });
    }
  };

  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importAllData(await file.text());
      store.loadCharacters();
      settingsStore.loadSettings();
    } catch {
      showAlert({ title: 'Import Failed', description: 'Invalid file format.', variant: 'error' });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClearData = async () => {
    const confirmed = await showConfirm({
      title: 'Clear All Data?',
      description: 'This will delete ALL characters, chats, messages, and memories permanently.',
      confirmText: 'Clear All',
      destructive: true,
    });
    if (confirmed) {
      await clearAllData();
      store.loadCharacters();
      settingsStore.loadSettings();
    }
  };

  const tabs = [
    { id: 'providers' as const, label: 'API Keys', icon: <KeyIcon className="w-4 h-4" /> },
    { id: 'model' as const, label: 'Model', icon: <Zap className="w-4 h-4" /> },
    { id: 'persona' as const, label: 'Your Profile', icon: <Bot className="w-4 h-4" /> },
    { id: 'memory' as const, label: 'Memory', icon: <Brain className="w-4 h-4" /> },
    { id: 'context' as const, label: 'Context', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'ui' as const, label: 'UI', icon: <Eye className="w-4 h-4" /> },
    { id: 'data' as const, label: 'Data', icon: <Download className="w-4 h-4" /> },
  ];

  return (
    // BUG FIX: Use `open` and `onOpenChange` from the store directly — the original
    // store.settingsOpen was sometimes `undefined` because setSettingsOpen might accept
    // a boolean directly. Using a safe boolean cast here.
    <Dialog open={!!store.settingsOpen} onOpenChange={(v) => store.setSettingsOpen(v)}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] flex flex-col p-0 overflow-hidden" aria-describedby="settings-desc">
        <DialogDescription id="settings-desc" className="sr-only">Application settings</DialogDescription>
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-border flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" /> Settings
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col sm:flex-row min-h-0">
          {/* Tabs */}
          <div className="sm:w-40 border-b sm:border-b-0 sm:border-r border-border p-2 flex sm:flex-col gap-1 overflow-x-auto sm:overflow-x-visible flex-shrink-0">
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? 'secondary' : 'ghost'}
                size="sm"
                className="justify-start gap-2 text-xs whitespace-nowrap h-8 flex-shrink-0"
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon} {tab.label}
              </Button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="p-4 space-y-4">

              {/* ---- PROVIDERS ---- */}
              {activeTab === 'providers' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
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
                          try { setTestResult(await settingsStore.testConnection()); }
                          catch { setTestResult({ success: false, message: 'Connection test failed' }); }
                          finally { setTesting(false); }
                        }}
                        disabled={testing}
                        className="gap-1"
                      >
                        {testing ? <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <Zap className="w-3 h-3" />}
                        Test
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setShowKeys(!showKeys)} className="gap-1">
                        {showKeys ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        {showKeys ? 'Hide' : 'Show'}
                      </Button>
                    </div>
                  </div>

                  {testResult && (
                    <div className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${testResult.success ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20' : 'bg-destructive/10 text-destructive border border-destructive/20'}`}>
                      {testResult.success ? <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                      <span className="flex-1">{testResult.message}</span>
                      <Button variant="ghost" size="icon" className="h-5 w-5 flex-shrink-0" onClick={() => setTestResult(null)}><X className="w-3 h-3" /></Button>
                    </div>
                  )}

                  <div className="space-y-2">
                    {settings.providers.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No providers configured. Add one below.</p>}
                    {settings.providers.map((p) => {
                      const info = providerList.find((pr) => pr.id === p.provider);
                      return (
                        <div key={p.provider} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                          <span className="text-lg flex-shrink-0">{info?.icon || '🔑'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{info?.name || p.provider}</p>
                            <p className="text-xs text-muted-foreground font-mono truncate">
                              {showKeys ? `${p.apiKey.slice(0, 8)}...${p.apiKey.slice(-4)}` : '•'.repeat(Math.min(p.apiKey.length, 16))}
                            </p>
                          </div>
                          <Button variant={settings.activeProvider === p.provider ? 'default' : 'outline'} size="sm" className="h-7 text-xs shrink-0" onClick={() => settingsStore.setActiveProvider(p.provider)}>
                            {settings.activeProvider === p.provider ? 'Active' : 'Select'}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={async () => {
                            const providerInfo = providers.find(pr => pr.id === p.provider);
                            const confirmed = await showConfirm({
                              title: `Remove ${providerInfo?.name || p.provider}?`,
                              description: 'API key and settings for this provider will be removed.',
                              confirmText: 'Remove',
                              destructive: true,
                            });
                            if (confirmed) settingsStore.removeProvider(p.provider);
                          }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>

                  <Separator />
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Add Provider</p>
                    <Select value={newProvider} onValueChange={(v) => { setNewProvider(v as AIProvider); setNewKey(''); setNewBaseUrl(''); }}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select provider..." /></SelectTrigger>
                      <SelectContent>
                        {providerList.filter((p) => !settings.providers.some((sp) => sp.provider === p.id)).map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.icon} {p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {newProvider === 'local' && (
                      <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs font-medium text-muted-foreground">Local LLM Settings</p>
                        <Select value={localPreset} onValueChange={(v) => {
                          setLocalPreset(v);
                          const preset = localPresets.find((p) => p.id === v);
                          setNewBaseUrl(preset?.id !== 'custom' ? preset?.baseUrl || '' : '');
                        }}>
                          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>{localPresets.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <Input placeholder="Base URL" value={newBaseUrl} onChange={(e) => setNewBaseUrl(e.target.value)} className="h-9 text-sm" />
                      </div>
                    )}
                    {newProvider && newProvider !== 'local' && (
                      <Input type={showKeys ? 'text' : 'password'} placeholder="API Key" value={newKey} onChange={(e) => setNewKey(e.target.value)} className="h-9 text-sm" autoComplete="off" />
                    )}
                    {newProvider === 'custom' && (
                      <Input placeholder="Custom Base URL (optional)" value={newBaseUrl} onChange={(e) => setNewBaseUrl(e.target.value)} className="h-9 text-sm" />
                    )}
                    <Button size="sm" onClick={handleAddProvider} disabled={!newProvider || (newProvider !== 'local' && !newKey.trim())} className="gap-1">
                      <Plus className="w-3 h-3" /> Add Provider
                    </Button>
                  </div>
                </div>
              )}

              {/* ---- MODEL ---- */}
              {activeTab === 'model' && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm">Model Selection</h3>
                  <div className="flex items-center gap-2">
                    <Checkbox id="useCustomModel" checked={useCustomModel} onCheckedChange={(v) => { setUseCustomModel(!!v); if (!v) setCustomModelInput(''); }} />
                    <Label htmlFor="useCustomModel" className="text-sm cursor-pointer">Enter custom model ID</Label>
                  </div>
                  {useCustomModel ? (
                    <div className="space-y-1">
                      <Input placeholder="e.g., gpt-4o, claude-3-5-sonnet" value={customModelInput} onChange={(e) => { setCustomModelInput(e.target.value); if (e.target.value.trim()) settingsStore.setActiveModel(e.target.value.trim()); }} className="text-sm" maxLength={200} />
                      <p className="text-xs text-muted-foreground">Enter the exact model ID your provider expects</p>
                    </div>
                  ) : (
                    <Select value={settings.activeModel} onValueChange={(v) => settingsStore.setActiveModel(v)}>
                      <SelectTrigger className="text-sm"><SelectValue placeholder="Select a model" /></SelectTrigger>
                      <SelectContent>
                        {models.length > 0 ? models.map((m) => (
                          <SelectItem key={m.id} value={m.id}>{m.name} <span className="text-muted-foreground ml-2 text-xs">({(m.maxContextTokens / 1000).toFixed(0)}k)</span></SelectItem>
                        )) : <SelectItem value="_none" disabled>No models for {settings.activeProvider}</SelectItem>}
                      </SelectContent>
                    </Select>
                  )}

                  <Separator />
                  <h4 className="text-sm font-medium">Generation Parameters</h4>
                  {[
                    { label: 'Temperature', key: 'temperature' as const, min: 0, max: 2, step: 0.05, desc: 'Higher = more creative' },
                    { label: 'Max Tokens', key: 'maxTokens' as const, min: 64, max: 4096, step: 64, desc: 'Max response length' },
                    { label: 'Top P', key: 'topP' as const, min: 0, max: 1, step: 0.05 },
                    { label: 'Frequency Penalty', key: 'frequencyPenalty' as const, min: 0, max: 2, step: 0.1, desc: 'Reduce repetition' },
                    { label: 'Presence Penalty', key: 'presencePenalty' as const, min: 0, max: 2, step: 0.1, desc: 'Encourage new topics' },
                  ].map(({ label, key, min, max, step, desc }) => {
                    const defaultVal = settingsDB.getDefaults()[key];
                    const currentValue = settings[key] as number;
                    const isDefault = currentValue === defaultVal;
                    return (
                      <div key={key} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <Label>{label}: {currentValue.toFixed(key === 'maxTokens' ? 0 : 2)}</Label>
                          <div className="flex items-center gap-2">
                            {desc && <span className="text-muted-foreground hidden sm:inline">{desc}</span>}
                            {!isDefault && (
                              <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground" onClick={() => settingsStore.updateSetting(key, defaultVal)} aria-label="Reset to default" title={`Reset to ${defaultVal}`}>
                                <RotateCcw className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <Slider value={[currentValue]} min={min} max={max} step={step} onValueChange={([v]) => settingsStore.updateSetting(key, v)} className="touch-none" />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ---- PERSONA ---- */}
              {activeTab === 'persona' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-sm">Your Profile</h3>
                    <p className="text-xs text-muted-foreground">Define who you are in roleplay conversations</p>
                  </div>
                  {[
                    { label: 'Your Name', key: 'name' as const, placeholder: 'How characters should call you...', multiline: false, max: 50 },
                    { label: 'Your Description', key: 'description' as const, placeholder: 'Your appearance, background...', multiline: true, max: 2000 },
                    { label: 'Your Personality', key: 'personality' as const, placeholder: 'Your traits, behavior patterns...', multiline: true, max: 1000 },
                    { label: 'Your Speech Style', key: 'speechPatterns' as const, placeholder: 'How you typically speak...', multiline: true, max: 1000 },
                  ].map(({ label, key, placeholder, multiline, max }) => (
                    <div key={key}>
                      <Label className="text-sm">{label}</Label>
                      {multiline ? (
                        <Textarea value={(settings.userPersona as any)[key] || ''} onChange={(e) => settingsStore.updateUserPersona({ [key]: e.target.value })} placeholder={placeholder} className="mt-1 min-h-[70px]" maxLength={max} />
                      ) : (
                        <Input value={(settings.userPersona as any)[key] || ''} onChange={(e) => settingsStore.updateUserPersona({ [key]: e.target.value })} placeholder={placeholder} className="mt-1" maxLength={max} />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* ---- MEMORY ---- */}
              {activeTab === 'memory' && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm">Memory System</h3>
                  {[
                    { label: 'Enable Memory', key: 'memoryEnabled' as const, desc: 'Extract and use memories in chat' },
                    { label: 'Auto-Extract Memories', key: 'autoExtractMemories' as const, desc: 'Automatically extract facts from messages' },
                  ].map(({ label, key, desc }) => (
                    <div key={key} className="flex items-center justify-between">
                      <div><Label className="text-sm">{label}</Label><p className="text-xs text-muted-foreground">{desc}</p></div>
                      <Switch checked={!!settings[key]} onCheckedChange={(v) => settingsStore.updateSetting(key, v)} />
                    </div>
                  ))}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Max Memories Per Query: {settings.maxMemoriesPerQuery}</Label>
                      {settings.maxMemoriesPerQuery !== 10 && (
                        <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground" onClick={() => settingsStore.updateSetting('maxMemoriesPerQuery', 10)} aria-label="Reset to default">
                          <RotateCcw className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                    <Slider value={[settings.maxMemoriesPerQuery]} min={1} max={30} step={1} onValueChange={([v]) => settingsStore.updateSetting('maxMemoriesPerQuery', v)} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Min Importance: {settings.memoryImportanceThreshold}</Label>
                      {settings.memoryImportanceThreshold !== 3 && (
                        <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground" onClick={() => settingsStore.updateSetting('memoryImportanceThreshold', 3)} aria-label="Reset to default">
                          <RotateCcw className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                    <Slider value={[settings.memoryImportanceThreshold]} min={1} max={8} step={1} onValueChange={([v]) => settingsStore.updateSetting('memoryImportanceThreshold', v)} />
                  </div>
                </div>
              )}

              {/* ---- CONTEXT ---- */}
              {activeTab === 'context' && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm">Context Window</h3>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Summarize After: {settings.summarizeThreshold} messages</Label>
                      {settings.summarizeThreshold !== 6 && (
                        <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground" onClick={() => settingsStore.updateSetting('summarizeThreshold', 6)} aria-label="Reset to default">
                          <RotateCcw className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                    <Slider value={[settings.summarizeThreshold]} min={8} max={50} step={2} onValueChange={([v]) => settingsStore.updateSetting('summarizeThreshold', v)} className="touch-none" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Keep Recent Messages: {settings.keepRecentCount}</Label>
                      {settings.keepRecentCount !== 6 && (
                        <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground" onClick={() => settingsStore.updateSetting('keepRecentCount', 6)} aria-label="Reset to default">
                          <RotateCcw className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                    <Slider value={[settings.keepRecentCount]} min={2} max={20} step={1} onValueChange={([v]) => settingsStore.updateSetting('keepRecentCount', v)} className="touch-none" />
                  </div>
                  <Separator />
                  <div>
                    <Label className="text-sm flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" />Behavior Instructions</Label>
                    <p className="text-xs text-muted-foreground mb-1">Prepended to system prompt. Overrides character-specific behavior instructions.</p>
                    <Textarea value={settings.jailbreakPrompt || ''} onChange={(e) => settingsStore.updateSetting('jailbreakPrompt', e.target.value)} placeholder="e.g., Write in a dark fantasy tone with descriptive prose..." className="text-xs min-h-[80px]" maxLength={3000} />
                  </div>
                  <div>
                    <Label className="text-sm flex items-center gap-1.5"><Settings className="w-3.5 h-3.5" />Custom System Prompt</Label>
                    <p className="text-xs text-muted-foreground mb-1">Replaces the auto-generated system prompt entirely. Use with caution.</p>
                    <Textarea value={settings.customSystemPrompt || ''} onChange={(e) => settingsStore.updateSetting('customSystemPrompt', e.target.value)} placeholder="Full system prompt for the AI..." className="text-xs min-h-[80px]" maxLength={5000} />
                  </div>
                </div>
              )}

              {/* ---- UI ---- */}
              {activeTab === 'ui' && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm">Appearance</h3>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Theme</Label>
                    <ThemeToggle />
                  </div>
                  {[
                    { label: 'Send on Enter', key: 'sendOnEnter' as const },
                    { label: 'Show Timestamps', key: 'showTimestamps' as const },
                    { label: 'Streaming', key: 'streamingEnabled' as const },
                  ].map(({ label, key }) => (
                    <div key={key} className="flex items-center justify-between">
                      <Label className="text-sm">{label}</Label>
                      <Switch checked={!!settings[key]} onCheckedChange={(v) => settingsStore.updateSetting(key, v)} />
                    </div>
                  ))}
                </div>
              )}

              {/* ---- DATA ---- */}
              {activeTab === 'data' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-sm">Data Management</h3>
                    <p className="text-xs text-muted-foreground">All data is stored locally on your device</p>
                  </div>
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full justify-start gap-2" onClick={handleExportData}><Download className="w-4 h-4" /> Export All Data</Button>
                    <Button variant="outline" className="w-full justify-start gap-2" onClick={() => fileInputRef.current?.click()}><Upload className="w-4 h-4" /> Import Data</Button>
                    <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportData} />
                    {store.activeCharacter && (
                      <>
                        <Separator />
                        <Button variant="outline" className="w-full justify-start gap-2" onClick={() => {
                          try {
                            const json = store.exportCharacter(store.activeCharacter!);
                            const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
                            const a = Object.assign(document.createElement('a'), { href: url, download: `${store.activeCharacter!.name.replace(/[^a-z0-9]/gi, '_')}.json` });
                            document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                          } catch { console.error('Export char failed'); }
                        }}>
                          <Download className="w-4 h-4" /> Export Current Character
                        </Button>
                      </>
                    )}
                    <Separator />
                    <Button variant="destructive" className="w-full justify-start gap-2" onClick={handleClearData}><Trash2 className="w-4 h-4" /> Clear All Data</Button>
                    <p className="text-xs text-muted-foreground text-center"><Shield className="w-3 h-3 inline mr-1" />No analytics, no tracking.</p>
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
  return (
    <Dialog open={!!store.characterEditorOpen} onOpenChange={(open) => { if (!open) store.setCharacterEditorOpen(false); }}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[92vh] flex flex-col p-0 overflow-hidden" aria-describedby="char-editor-desc">
        <DialogDescription id="char-editor-desc" className="sr-only">Character editor</DialogDescription>
        {/* BUG FIX: key forces full remount when editingCharacter changes */}
        <CharacterEditorInner key={store.editingCharacter?.id ?? 'new'} />
      </DialogContent>
    </Dialog>
  );
}

function CharacterEditorInner() {
  const store = useChatStore();
  const settingsStore = useSettingsStore();
  const { toast } = useToast();
  const { showConfirm } = useConfirmDialog();
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
  const [activeField, setActiveField] = useState(isEditing ? 'identity' : 'templates');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [enhancingPrompt, setEnhancingPrompt] = useState(false);
  const [generationPrompt, setGenerationPrompt] = useState('');
  const [generationError, setGenerationError] = useState<string | null>(null);

  const updateForm = useCallback(<K extends keyof Character>(key: K, value: Character[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

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
    if (!isEditing) store.selectCharacter(character);
  }, [form, initialCharacter, isEditing, store]);

  const addTag = useCallback(() => {
    const t = tagInput.trim();
    if (!t || form.tags?.includes(t)) { setTagInput(''); return; }
    setForm((f) => ({ ...f, tags: [...(f.tags || []), t] }));
    setTagInput('');
  }, [tagInput, form.tags]);

  const removeTag = useCallback((tag: string) => {
    setForm((f) => ({ ...f, tags: (f.tags || []).filter((t) => t !== tag) }));
  }, []);

  const handleGenerateCharacter = useCallback(async () => {
    setGenerating(true);
    setGenerationError(null);
    try {
      const generated = await generateCharacter(settingsStore.settings, { userPrompt: generationPrompt });
      if (generated) {
        setForm((f) => ({ ...f, ...generated }));
        setSelectedTemplate('ai-generated');
        setGenerationPrompt('');
      }
    } catch (e) {
      setGenerationError(e instanceof Error ? e.message : 'Failed to generate character');
    } finally {
      setGenerating(false);
    }
  }, [generationPrompt, settingsStore.settings]);

  const applyTemplate = useCallback((template: CharacterTemplate) => {
    setSelectedTemplate(template.id);
    setForm((f) => ({ ...f, ...template.character, tags: template.character.tags || f.tags }));
  }, []);

  const handleGenerateAvatar = useCallback(async () => {
    if (!form.name) return;
    const nvidiaConfig = settingsStore.settings.providers.find((p) => p.provider === 'nvidia');
    if (!nvidiaConfig?.apiKey) return;
    setGenerating(true);
    try {
      const imageModel = settingsStore.settings.nvidiaImageModel || 'stabilityai/stable-diffusion-3-medium';
      const modelDefaults: Record<string, { steps: number; cfg_scale: number }> = {
        'stabilityai/stable-diffusion-3-medium': { steps: 50, cfg_scale: 5 },
        'stabilityai/stable-diffusion-xl': { steps: 25, cfg_scale: 5 },
        'black-forest-labs/flux.1-dev': { steps: 50, cfg_scale: 5 },
        'black-forest-labs/flux.1-schnell': { steps: 4, cfg_scale: 0 },
        'black-forest-labs/flux.2-klein-4b': { steps: 4, cfg_scale: 1 },
      };
      const defaults = modelDefaults[imageModel] || { steps: 50, cfg_scale: 5 };

      let basePrompt = form.useCustomAvatarPrompt && form.customAvatarPrompt?.trim()
        ? form.customAvatarPrompt.trim()
        : `portrait of ${form.name}, ${(form.description || '').slice(0, 180)}, ${(form.personality || '').slice(0, 100)}, natural lighting, soft shadows, high detail, 8k, professional photo, headshot`;

      let finalPrompt = basePrompt;
      if (settingsStore.settings.enhanceImagePrompts && !form.useCustomAvatarPrompt) {
        try { finalPrompt = await enhanceImagePrompt(settingsStore.settings, basePrompt, `Character: ${form.name}. Portrait/avatar.`); }
        catch { /* use base */ }
      }
      finalPrompt = finalPrompt.slice(0, 800);

      const resp = await fetch('https://roleplay.jameskaren.workers.dev/v1/genai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: finalPrompt, model: imageModel, cfg_scale: defaults.cfg_scale,
          aspect_ratio: '1:1', seed: Math.floor(Math.random() * 1000000), steps: defaults.steps,
          negative_prompt: imageModel.includes('flux') ? undefined : 'cartoon, anime, illustration, drawing, 3d render, deformed, blurry, watermark, text',
          apiKey: nvidiaConfig.apiKey,
        }),
      });

      if (!resp.ok) throw new Error(`Status ${resp.status}`);
      const data = await resp.json();
      const reason = data.artifacts?.[0]?.finishReason || data.artifacts?.[0]?.finish_reason;
      if (reason === 'CONTENT_FILTERED') throw new Error('CONTENT_FILTERED');

      const raw = data.image || data.artifacts?.[0]?.base64 || data.artifacts?.[0]?.image || data.images?.[0];
      if (raw) {
        updateForm('avatar', raw.startsWith('data:') ? raw : `data:image/jpeg;base64,${raw}`);
        updateForm('lastUsedPrompt', finalPrompt);
      } else {
        throw new Error('No image data in response');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      toast({ variant: 'destructive', title: 'Image generation failed', description: msg.includes('CONTENT_FILTERED') ? 'Content filtered. Try a different description.' : 'Generation failed. Try again.' });
    } finally {
      setGenerating(false);
    }
  }, [form, settingsStore, updateForm, toast]);

  const fields = [
    { id: 'templates', label: 'Templates', icon: <Bot className="w-4 h-4" /> },
    { id: 'identity', label: 'Identity', icon: <Pencil className="w-4 h-4" /> },
    { id: 'personality', label: 'Personality', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'scenario', label: 'Scenario', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'advanced', label: 'Advanced', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <>
      <DialogHeader className="px-6 pt-5 pb-3 border-b border-border flex-shrink-0">
        <DialogTitle>{isEditing ? 'Edit Character' : 'Create Character'}</DialogTitle>
      </DialogHeader>

      <div className="flex-1 overflow-hidden flex flex-col sm:flex-row min-h-0">
        {/* Field Tabs */}
        <div className="sm:w-36 border-b sm:border-b-0 sm:border-r border-border p-2 flex sm:flex-col gap-1 overflow-x-auto sm:overflow-x-visible flex-shrink-0">
          {fields.map((f) => (
            <Button key={f.id} variant={activeField === f.id ? 'secondary' : 'ghost'} size="sm" className="justify-start gap-2 text-xs whitespace-nowrap h-8 flex-shrink-0" onClick={() => setActiveField(f.id)}>
              {f.icon} {f.label}
            </Button>
          ))}
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="p-4 space-y-4">

            {activeField === 'templates' && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-sm">Create Your Character</h3>
                  <p className="text-xs text-muted-foreground">Choose a template or let AI generate one</p>
                </div>
                <div className="p-4 rounded-lg border border-dashed border-primary/30 bg-primary/5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /><span className="text-sm font-medium">AI Generate</span></div>
                    <Button size="sm" onClick={handleGenerateCharacter} disabled={generating} className="gap-1">
                      {generating ? <><div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />Generating...</> : <><Sparkles className="w-3 h-3" />Generate</>}
                    </Button>
                  </div>
                  <Input value={generationPrompt} onChange={(e) => setGenerationPrompt(e.target.value)} placeholder="Describe the character (optional)" className="h-8 text-xs" onKeyDown={(e) => { if (e.key === 'Enter' && !generating) handleGenerateCharacter(); }} maxLength={500} />
                  {generationError && <p className="text-xs text-destructive">{generationError}</p>}
                </div>

                <div className="relative flex items-center gap-3">
                  <Separator className="flex-1" />
                  <span className="text-xs text-muted-foreground uppercase">or choose template</span>
                  <Separator className="flex-1" />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {CHARACTER_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      onClick={async () => {
                        if (isEditing && form.name) {
                          const ok = await showConfirm({ title: 'Apply Template?', description: 'This will replace current fields.', confirmText: 'Apply' });
                          if (ok) applyTemplate(template);
                        } else {
                          applyTemplate(template);
                        }
                      }}
                      className={`p-3 rounded-lg border text-left transition-all hover:border-primary/50 ${selectedTemplate === template.id ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border'}`}
                    >
                      <div className="text-2xl mb-1">{template.icon}</div>
                      <div className="text-sm font-medium">{template.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{template.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeField === 'identity' && (
              <div className="space-y-3">
                <div>
                  <Label className="text-sm">Name *</Label>
                  <Input value={form.name || ''} onChange={(e) => updateForm('name', e.target.value)} placeholder="Character name" className="mt-1" maxLength={100} />
                </div>
                <div>
                  <Label className="text-sm">Avatar URL or Base64</Label>
                  <div className="flex gap-2 mt-1">
                    <Input value={form.avatar || ''} onChange={(e) => updateForm('avatar', e.target.value)} placeholder="https://..." className="flex-1 text-xs" />
                    {settingsStore.settings.activeProvider === 'nvidia' && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button type="button" variant="outline" size="icon" onClick={handleGenerateAvatar} disabled={generating || !form.name}>
                              {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Generate avatar with AI</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  {form.avatar && (
                    <div className="mt-2 w-20 h-20 rounded-full overflow-hidden border border-border">
                      <img src={form.avatar} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-sm">Custom Avatar Prompt</Label>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Use custom</Label>
                      <Checkbox checked={form.useCustomAvatarPrompt || false} onCheckedChange={(v) => updateForm('useCustomAvatarPrompt', !!v)} />
                    </div>
                  </div>
                  <div className="relative">
                    <Textarea value={form.customAvatarPrompt || ''} onChange={(e) => updateForm('customAvatarPrompt', e.target.value)} placeholder="Custom prompt for avatar generation..." className="min-h-[70px] pr-10" maxLength={1000} disabled={!form.useCustomAvatarPrompt} />
                    {form.useCustomAvatarPrompt && form.customAvatarPrompt && (
                      <Button type="button" size="icon" variant="ghost" className="absolute right-2 bottom-2 h-7 w-7" disabled={enhancingPrompt} onClick={async () => {
                        if (!form.customAvatarPrompt?.trim()) return;
                        setEnhancingPrompt(true);
                        try {
                          const enhanced = await enhanceTextPrompt(settingsStore.settings, form.customAvatarPrompt);
                          updateForm('customAvatarPrompt', enhanced);
                          toast({ title: 'Prompt enhanced!' });
                        } catch { toast({ title: 'Failed to enhance', variant: 'destructive' }); }
                        finally { setEnhancingPrompt(false); }
                      }}>
                        {enhancingPrompt ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-primary" />}
                      </Button>
                    )}
                  </div>
                  {form.lastUsedPrompt && (
                    <div className="mt-1 p-2 bg-muted/40 rounded-md text-[11px] leading-snug text-muted-foreground whitespace-pre-wrap break-words selectable">
                      {form.lastUsedPrompt}
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-sm">Description *</Label>
                  <p className="text-xs text-muted-foreground mb-1">Physical appearance, background</p>
                  <Textarea value={form.description || ''} onChange={(e) => updateForm('description', e.target.value)} placeholder="A young woman with long silver hair..." className="min-h-[100px]" maxLength={5000} />
                </div>
                <div>
                  <Label className="text-sm">Tags</Label>
                  <div className="flex flex-wrap gap-1 mt-1 mb-1">
                    {(form.tags || []).map((tag) => (
                      <Badge key={tag} variant="secondary" className="gap-1 text-xs">
                        {tag}
                        <button onClick={() => removeTag(tag)} aria-label={`Remove ${tag}`}><X className="w-3 h-3" /></button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} placeholder="Add tag..." className="h-8 text-sm flex-1" maxLength={30} />
                    <Button variant="outline" size="sm" onClick={addTag} type="button"><Plus className="w-3 h-3" /></Button>
                  </div>
                </div>
              </div>
            )}

            {activeField === 'personality' && (
              <div className="space-y-3">
                {[
                  { label: 'Personality *', key: 'personality' as keyof Character, placeholder: 'Kind but reserved, slow to trust...', desc: 'Core traits, mannerisms, quirks', rows: 4 },
                  { label: 'Speech Patterns', key: 'speechPatterns' as keyof Character, placeholder: 'Speaks formally, uses archaic phrases...', desc: 'How they talk', rows: 3 },
                  { label: 'Likes', key: 'likes' as keyof Character, placeholder: 'Things they enjoy', rows: 2 },
                  { label: 'Dislikes', key: 'dislikes' as keyof Character, placeholder: 'Things they hate', rows: 2 },
                ].map(({ label, key, placeholder, desc, rows }) => (
                  <div key={key as string}>
                    <Label className="text-sm">{label}</Label>
                    {desc && <p className="text-xs text-muted-foreground mb-1">{desc}</p>}
                    <Textarea value={(form[key] as string) || ''} onChange={(e) => updateForm(key, e.target.value as any)} placeholder={placeholder} className="min-h-[84px]" style={{ minHeight: `${rows * 28}px` }} maxLength={3000} />
                  </div>
                ))}
              </div>
            )}

            {activeField === 'scenario' && (
              <div className="space-y-3">
                {[
                  { label: 'Scenario / Setting', key: 'scenario' as keyof Character, placeholder: 'A medieval fantasy world...', desc: 'The world, situation, or starting context' },
                  { label: 'Relationship to User', key: 'relationship' as keyof Character, placeholder: 'Strangers who just met...' },
                  { label: 'First Message *', key: 'firstMessage' as keyof Character, placeholder: '*The bell above the door chimes* Oh, hello there...', desc: "The character's opening greeting" },
                  { label: 'Example Dialogue', key: 'exampleMessages' as keyof Character, placeholder: '<START>\n{{user}}: Hello!\n{{char}}: *smiles* Welcome.', desc: 'Example messages ({{user}}/{{char}} format)', mono: true },
                ].map(({ label, key, placeholder, desc, mono }) => (
                  <div key={key as string}>
                    <Label className="text-sm">{label}</Label>
                    {desc && <p className="text-xs text-muted-foreground mb-1">{desc}</p>}
                    <Textarea value={(form[key] as string) || ''} onChange={(e) => updateForm(key, e.target.value as any)} placeholder={placeholder} className={`min-h-[80px] ${mono ? 'font-mono text-xs' : ''}`} maxLength={5000} />
                  </div>
                ))}
              </div>
            )}

            {activeField === 'advanced' && (
              <div className="space-y-3">
                {[
                  { label: 'Knowledge', key: 'knowledge' as keyof Character, placeholder: 'Knows ancient elvish, skilled in potion-making...', desc: "What the character knows" },
                  { label: 'Behavioral Guidelines', key: 'behavior' as keyof Character, placeholder: 'Always maintain mystery...', desc: 'How the character should behave' },
                  { label: 'Custom System Prompt (Override)', key: 'systemPrompt' as keyof Character, placeholder: "Write {{char}}'s entire system prompt here...", desc: 'Replaces auto-generated system prompt entirely' },
                  { label: 'Creator Notes', key: 'creatorNotes' as keyof Character, placeholder: 'Private notes...', desc: 'Private notes (not sent to AI)' },
                ].map(({ label, key, placeholder, desc }) => (
                  <div key={key as string}>
                    <Label className="text-sm">{label}</Label>
                    {desc && <p className="text-xs text-muted-foreground mb-1">{desc}</p>}
                    <Textarea value={(form[key] as string) || ''} onChange={(e) => updateForm(key, e.target.value as any)} placeholder={placeholder} className="min-h-[80px]" maxLength={10000} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-border flex justify-end gap-2 flex-shrink-0">
        {isEditing && initialCharacter && (
          <Button variant="destructive" size="sm" onClick={async () => {
            const confirmed = await showConfirm({ title: `Delete "${initialCharacter.name}"?`, description: 'This cannot be undone.', confirmText: 'Delete', destructive: true });
            if (confirmed) { store.deleteCharacter(initialCharacter.id); store.setCharacterEditorOpen(false); }
          }}>Delete</Button>
        )}
        <Button variant="outline" onClick={() => store.setCharacterEditorOpen(false)}>Cancel</Button>
        <Button onClick={handleSave} disabled={!form.name?.trim()}>{isEditing ? 'Save Changes' : 'Create Character'}</Button>
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
    if (showFavorites) chars = chars.filter((c) => c.isFavorite);
    if (search) {
      const lower = search.toLowerCase();
      chars = chars.filter((c) => c.name.toLowerCase().includes(lower) || c.tags?.some((t) => t.toLowerCase().includes(lower)));
    }
    return chars;
  }, [store.characters, search, showFavorites]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[300px] max-w-[85vw] p-0 flex flex-col">
        <SheetHeader className="p-4 pb-3 border-b border-border flex-shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" /> RolePlay Chat
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Characters */}
          <div className="border-b border-border">
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-1.5"><Bot className="w-4 h-4" /> Characters</h3>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { store.setCharacterEditorOpen(true); onOpenChange(false); }}><Plus className="w-4 h-4" /></Button>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
              </div>
              <Button variant={showFavorites ? 'secondary' : 'ghost'} size="sm" className="h-8 text-xs w-full" onClick={() => setShowFavorites(!showFavorites)}>
                <Star className="w-3 h-3 mr-1" /> Favorites
              </Button>
            </div>
            <div className="px-2 pb-3 space-y-1">
              {filtered.length === 0 && (
                <div className="text-center text-muted-foreground py-6 space-y-2">
                  <p className="text-xs">{showFavorites ? 'No favorites yet' : 'No characters yet'}</p>
                  {!showFavorites && (
                    <Button variant="outline" size="sm" className="text-xs h-8 mx-auto" onClick={() => { store.setCharacterEditorOpen(true); onOpenChange(false); }}>
                      Create your first character
                    </Button>
                  )}
                </div>
              )}
              {filtered.map((char) => (
                <div key={char.id} className="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-muted/50 min-w-0" onClick={() => { store.selectCharacter(char); onOpenChange(false); }}>
                  <CharacterAvatar character={char} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{char.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{char.tags?.slice(0, 2).join(', ') || 'No tags'}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {char.isFavorite && <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); store.setCharacterEditorOpen(true, char); onOpenChange(false); }}><Pencil className="w-3 h-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={async (e) => {
                      e.stopPropagation();
                      const ok = await showConfirm({ title: `Delete "${char.name}"?`, description: 'This cannot be undone.', confirmText: 'Delete', destructive: true });
                      if (ok) store.deleteCharacter(char.id);
                    }}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chats */}
          {store.activeCharacter && (
            <div>
              <div className="p-3 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-semibold truncate">Chats with {store.activeCharacter.name}</h3>
                <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => { store.newChat(store.activeCharacter!); onOpenChange(false); }}><Plus className="w-4 h-4" /></Button>
              </div>
              <div className="p-2 space-y-0.5">
                {store.chats.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Tap the + button above to start a new chat</p>}
                {store.chats.map((chat) => (
                  <div key={chat.id} className={`flex items-center gap-1.5 px-2.5 py-2.5 rounded-lg cursor-pointer text-sm min-w-0 hover:bg-muted/50 ${store.activeChat?.id === chat.id ? 'bg-muted' : ''}`} onClick={() => { store.selectChat(chat); onOpenChange(false); }}>
                    <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
                    <span className="truncate flex-1 min-w-0">{chat.title}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 hover:text-destructive" onClick={async (e) => {
                      e.stopPropagation();
                      const ok = await showConfirm({ title: 'Delete this chat?', description: 'Cannot be undone.', confirmText: 'Delete', destructive: true });
                      if (ok) store.deleteChat(chat.id);
                    }}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-border flex-shrink-0 space-y-1">
          <Button variant="ghost" className="w-full justify-start gap-2 min-h-[44px]" onClick={() => { store.setSettingsOpen(true); onOpenChange(false); }}>
            <Settings className="w-4 h-4" /> Settings
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ============================================================
// MEMORY PANEL
// ============================================================
function MemoryPanelSheet() {
  const store = useChatStore();
  const memories = store.memories;

  const getTypeColor = (type: string) => {
    const map: Record<string, string> = {
      fact: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      event: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
      emotion: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20',
      preference: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
      instruction: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
    };
    return map[type] || 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20';
  };

  const relTime = (ts: number) => {
    const d = Math.floor((Date.now() - ts) / 86400000);
    if (d === 0) return 'Today';
    if (d === 1) return 'Yesterday';
    if (d < 7) return `${d} days ago`;
    if (d < 30) return `${Math.floor(d / 7)}w ago`;
    return `${Math.floor(d / 30)}mo ago`;
  };

  const byType = useMemo(() =>
    memories.reduce<Record<string, number>>((acc, m) => { acc[m.type || 'unknown'] = (acc[m.type || 'unknown'] || 0) + 1; return acc; }, {}),
    [memories]
  );

  return (
    <Sheet open={!!store.memoryPanelOpen} onOpenChange={store.setMemoryPanelOpen}>
      <SheetContent className="w-80 sm:w-96 flex flex-col p-0">
        <SheetHeader className="p-4 pb-3 border-b border-border flex-shrink-0">
          <SheetTitle className="flex items-center gap-2"><Brain className="w-5 h-5" /> Memory</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {memories.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                  <p className="text-2xl font-bold">{memories.length}</p>
                  <p className="text-xs text-muted-foreground">Total Memories</p>
                </div>
                <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/10">
                  <p className="text-2xl font-bold">{memories.filter((m) => m.accessCount > 2).length}</p>
                  <p className="text-xs text-muted-foreground">Active</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {Object.entries(byType).map(([type, count]) => (
                  <Badge key={type} variant="outline" className={`text-xs ${getTypeColor(type)}`}>{type}: {count}</Badge>
                ))}
              </div>
            </>
          )}
          {memories.length === 0 ? (
            <div className="text-center py-12">
              <Brain className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">No memories yet</p>
              <p className="text-xs text-muted-foreground mt-1">Extracted automatically as you chat</p>
            </div>
          ) : (
            <div className="space-y-2">
              {memories.map((mem) => (
                <div key={mem.id} className="p-3 rounded-lg bg-muted/30 hover:border-border/50 border border-transparent transition-colors space-y-2 group">
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="outline" className={`text-[10px] h-5 ${getTypeColor(mem.type || 'unknown')}`}>{mem.type || 'unknown'}</Badge>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" onClick={() => store.deleteMemory(mem.id)} aria-label="Delete memory">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  <p className="text-sm leading-relaxed break-words">{mem.content}</p>
                  {mem.keywords?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {mem.keywords.slice(0, 5).map((kw) => <span key={kw} className="text-[10px] text-muted-foreground bg-background/50 px-1.5 py-0.5 rounded">#{kw}</span>)}
                    </div>
                  )}
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{relTime(mem.timestamp)}</span>
                    <span>{mem.accessCount} refs · {'★'.repeat(Math.min(Math.ceil((mem.importance || 0) / 2), 5))}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ============================================================
// KEY ICON
// ============================================================
function KeyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="m21 2-9.3 9.3" />
      <path d="m18.4 4.6-2.8 2.8" />
    </svg>
  );
}