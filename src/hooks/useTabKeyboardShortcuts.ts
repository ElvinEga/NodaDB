import { useEffect } from 'react';

interface TabKeyboardHandlers {
  onNewTab?: () => void;
  onCloseTab?: () => void;
  onNextTab?: () => void;
  onPrevTab?: () => void;
  onJumpToTab?: (index: number) => void;
  onCloseAllTabs?: () => void;
}

export function useTabKeyboardShortcuts(handlers: TabKeyboardHandlers) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac =
        typeof navigator !== 'undefined' &&
        (/Mac|iPhone|iPad|iPod/.test(navigator.userAgent) ||
          navigator.platform.toUpperCase().indexOf('MAC') >= 0);
      const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;
      const key = e.key.toLowerCase();

      // Ctrl/Cmd + N - New Query Tab
      if (ctrlOrCmd && key === 'n' && handlers.onNewTab) {
        e.preventDefault();
        handlers.onNewTab();
      }

      // Ctrl/Cmd + W - Close Tab
      if (ctrlOrCmd && key === 'w' && !e.shiftKey && handlers.onCloseTab) {
        e.preventDefault();
        handlers.onCloseTab();
      }

      // Ctrl/Cmd + Shift + W - Close All Tabs
      if (ctrlOrCmd && e.shiftKey && key === 'w' && handlers.onCloseAllTabs) {
        e.preventDefault();
        handlers.onCloseAllTabs();
      }

      // Ctrl + Tab - Next Tab
      if (e.ctrlKey && e.key === 'Tab' && !e.shiftKey && handlers.onNextTab) {
        e.preventDefault();
        handlers.onNextTab();
      }

      // Ctrl + Shift + Tab - Previous Tab
      if (e.ctrlKey && e.shiftKey && e.key === 'Tab' && handlers.onPrevTab) {
        e.preventDefault();
        handlers.onPrevTab();
      }

      // Ctrl/Cmd + 1-9 - Jump to Tab by Number
      if (ctrlOrCmd && !e.shiftKey && handlers.onJumpToTab) {
        const num = parseInt(e.key);
        if (num >= 1 && num <= 9) {
          e.preventDefault();
          handlers.onJumpToTab(num - 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}
