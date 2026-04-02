// ============================================================
// Global Context Menu Store
// ============================================================
import { create } from 'zustand';

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
  separator?: boolean;
}

interface ContextMenuStore {
  visible: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
  show: (e: React.MouseEvent | React.TouchEvent, items: ContextMenuItem[]) => void;
  hide: () => void;
}

export const useContextMenuStore = create<ContextMenuStore>((set) => ({
  visible: false,
  x: 0,
  y: 0,
  items: [],
  show: (e, items) => {
    e.preventDefault();
    e.stopPropagation();

    let x: number;
    let y: number;

    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      x = touch.clientX;
      y = touch.clientY;
    } else {
      x = e.clientX;
      y = e.clientY;
    }

    // Adjust position to keep menu in viewport
    const menuWidth = 200;
    const menuHeight = items.length * 40;

    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10;
    }
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 10;
    }

    set({ visible: true, x, y, items });
  },
  hide: () => set({ visible: false, items: [] }),
}));

// Hook wrapper for convenience
export function useContextMenu() {
  const store = useContextMenuStore();
  return {
    showContextMenu: store.show,
    hideContextMenu: store.hide,
  };
}
