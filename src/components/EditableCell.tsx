import { useState, useEffect, useRef } from 'react';
import { TableState } from '@/lib/table-state';

interface EditableCellProps {
  initialValue: any;
  state: TableState;
  y: number;
  x: number;
}

export const EditableCell = ({ initialValue, state, y, x }: EditableCellProps) => {
  const [value, setValue] = useState(String(initialValue ?? ''));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  const commitChange = () => {
    state.changeValue(y, x, value);
    state.exitEditMode();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    
    if (e.key === 'Enter') {
      commitChange();
      state.moveFocus(1, 0);
    }
    if (e.key === 'Escape') {
      state.exitEditMode();
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      commitChange();
      state.moveFocus(0, e.shiftKey ? -1 : 1);
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commitChange}
      onKeyDown={handleKeyDown}
      className="absolute inset-0 w-full h-full p-2 bg-background dark:bg-neutral-950 border-0 outline-none ring-2 ring-blue-500 z-20 font-mono text-xs"
    />
  );
};
