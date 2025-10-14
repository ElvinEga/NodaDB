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
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl/Cmd + N - New Query Tab
      if (ctrlOrCmd && e.key === 'n' && handlers.onNewTab) {
        e.preventDefault();
        handlers.onNewTab();
      }

      // Ctrl/Cmd + W - Close Tab
      if (ctrlOrCmd && e.key === 'w' && handlers.onCloseTab) {
        e.preventDefault();
        handlers.onCloseTab();
      }

      // Ctrl/Cmd + Shift + W - Close All Tabs
      if (ctrlOrCmd && e.shiftKey && e.key === 'W' && handlers.onCloseAllTabs) {
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
