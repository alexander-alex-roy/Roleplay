// ============================================================
// Custom Context Menu Component (for global use)
// ============================================================

"use client"

import React from 'react';
import { useContextMenuStore, type ContextMenuItem } from '@/stores/context-menu-store';

interface CustomContextMenuProps {
  state: {
    visible: boolean;
    x: number;
    y: number;
    items: ContextMenuItem[];
  };
}

export function CustomContextMenu({ state }: CustomContextMenuProps) {
  if (!state.visible) return null;

  return (
    <div
      className="fixed z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[160px] sm:min-w-[180px] animate-in fade-in zoom-in-95 duration-100 touch-manipulation"
      style={{
        left: state.x,
        top: state.y,
      }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {state.items.map((item, index) => {
        if (item.separator) {
          return <div key={`sep-${index}`} className="h-px bg-border my-1" />;
        }

        return (
          <button
            key={index}
            className={`w-full px-3 py-2 text-sm flex items-center gap-2 transition-colors touch-manipulation ${
              item.disabled
                ? 'opacity-50 cursor-not-allowed'
                : item.destructive
                  ? 'text-destructive hover:bg-destructive/10'
                  : 'hover:bg-accent'
            }`}
            disabled={item.disabled}
            onClick={() => {
              if (!item.disabled) {
                item.onClick();
                useContextMenuStore.getState().hide();
              }
            }}
          >
            {item.icon && <span className="w-4 h-4 flex-shrink-0">{item.icon}</span>}
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
