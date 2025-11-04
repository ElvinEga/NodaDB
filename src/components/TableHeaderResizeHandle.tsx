import { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface ResizeHandleProps {
  onResize: (newWidth: number) => void;
  initialWidth: number;
}

export const TableHeaderResizeHandle = ({ onResize, initialWidth }: ResizeHandleProps) => {
  const handleRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;

    const onMouseMove = (e: MouseEvent) => {
      requestAnimationFrame(() => {
        const th = handle.parentElement;
        if (!th) return;
        
        const startX = th.getBoundingClientRect().left;
        const newWidth = e.clientX - startX;
        onResize(newWidth);
      });
    };

    const onMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isResizing) {
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

  }, [isResizing, onResize]);

  return (
    <div
      ref={handleRef}
      onMouseDown={() => setIsResizing(true)}
      className={cn(
        "absolute top-0 right-0 h-full w-2 cursor-col-resize group-hover:bg-blue-300/30 transition-colors",
        isResizing && "bg-blue-500"
      )}
    />
  );
};
