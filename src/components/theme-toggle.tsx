'use client';

import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Moon, Sun, Monitor } from 'lucide-react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  return (
    <Button variant="outline" size="sm" onClick={cycleTheme} className="gap-1.5 h-8">
      {theme === 'light' && <Sun className="w-3.5 h-3.5" />}
      {theme === 'dark' && <Moon className="w-3.5 h-3.5" />}
      {(!theme || theme === 'system') && <Monitor className="w-3.5 h-3.5" />}
      <span className="text-xs capitalize">{theme || 'system'}</span>
    </Button>
  );
}
