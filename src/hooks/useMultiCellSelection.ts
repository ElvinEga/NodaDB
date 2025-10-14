import { useState, useCallback, useRef } from 'react';

export interface CellPosition {
  rowIndex: number;
  columnIndex: number;
}

export interface CellRange {
  start: CellPosition;
  end: CellPosition;
}

export interface SelectedCell {
  rowIndex: number;
  columnIndex: number;
  rowId: string | number;
  columnId: string;
  value: any;
}

export function useMultiCellSelection() {
  const [selectedRange, setSelectedRange] = useState<CellRange | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [anchorCell, setAnchorCell] = useState<CellPosition | null>(null);
  const selectionStartRef = useRef<CellPosition | null>(null);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedRange(null);
    setAnchorCell(null);
    selectionStartRef.current = null;
  }, []);

  // Start selection
  const startSelection = useCallback((cell: CellPosition) => {
    setIsSelecting(true);
    setAnchorCell(cell);
    selectionStartRef.current = cell;
    setSelectedRange({ start: cell, end: cell });
  }, []);

  // Update selection during mouse move
  const updateSelection = useCallback(
    (cell: CellPosition) => {
      if (!isSelecting || !selectionStartRef.current) return;

      setSelectedRange({
        start: selectionStartRef.current,
        end: cell,
      });
    },
    [isSelecting]
  );

  // End selection
  const endSelection = useCallback(() => {
    setIsSelecting(false);
  }, []);

  // Check if cell is in selected range
  const isCellSelected = useCallback(
    (rowIndex: number, columnIndex: number): boolean => {
      if (!selectedRange) return false;

      const minRow = Math.min(selectedRange.start.rowIndex, selectedRange.end.rowIndex);
      const maxRow = Math.max(selectedRange.start.rowIndex, selectedRange.end.rowIndex);
      const minCol = Math.min(selectedRange.start.columnIndex, selectedRange.end.columnIndex);
      const maxCol = Math.max(selectedRange.start.columnIndex, selectedRange.end.columnIndex);

      return (
        rowIndex >= minRow &&
        rowIndex <= maxRow &&
        columnIndex >= minCol &&
        columnIndex <= maxCol
      );
    },
    [selectedRange]
  );

  // Get all selected cells in the range
  const getSelectedCells = useCallback((): SelectedCell[] => {
    if (!selectedRange) return [];

    const cells: SelectedCell[] = [];
    const minRow = Math.min(selectedRange.start.rowIndex, selectedRange.end.rowIndex);
    const maxRow = Math.max(selectedRange.start.rowIndex, selectedRange.end.rowIndex);
    const minCol = Math.min(selectedRange.start.columnIndex, selectedRange.end.columnIndex);
    const maxCol = Math.max(selectedRange.start.columnIndex, selectedRange.end.columnIndex);

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        cells.push({
          rowIndex: row,
          columnIndex: col,
          rowId: '', // Will be populated by the component
          columnId: '', // Will be populated by the component
          value: null, // Will be populated by the component
        });
      }
    }

    return cells;
  }, [selectedRange]);

  // Get selection bounds
  const getSelectionBounds = useCallback(() => {
    if (!selectedRange) return null;

    const minRow = Math.min(selectedRange.start.rowIndex, selectedRange.end.rowIndex);
    const maxRow = Math.max(selectedRange.start.rowIndex, selectedRange.end.rowIndex);
    const minCol = Math.min(selectedRange.start.columnIndex, selectedRange.end.columnIndex);
    const maxCol = Math.max(selectedRange.start.columnIndex, selectedRange.end.columnIndex);

    return {
      minRow,
      maxRow,
      minCol,
      maxCol,
      rowCount: maxRow - minRow + 1,
      colCount: maxCol - minCol + 1,
      totalCells: (maxRow - minRow + 1) * (maxCol - minCol + 1),
    };
  }, [selectedRange]);

  // Extend selection with keyboard
  const extendSelection = useCallback(
    (direction: 'up' | 'down' | 'left' | 'right') => {
      if (!selectedRange) return;

      const newEnd = { ...selectedRange.end };

      switch (direction) {
        case 'up':
          newEnd.rowIndex = Math.max(0, newEnd.rowIndex - 1);
          break;
        case 'down':
          newEnd.rowIndex = newEnd.rowIndex + 1;
          break;
        case 'left':
          newEnd.columnIndex = Math.max(0, newEnd.columnIndex - 1);
          break;
        case 'right':
          newEnd.columnIndex = newEnd.columnIndex + 1;
          break;
      }

      setSelectedRange({
        start: selectedRange.start,
        end: newEnd,
      });
    },
    [selectedRange]
  );

  // Select all cells in range
  const selectRange = useCallback((start: CellPosition, end: CellPosition) => {
    setSelectedRange({ start, end });
    setAnchorCell(start);
  }, []);

  return {
    selectedRange,
    isSelecting,
    anchorCell,
    startSelection,
    updateSelection,
    endSelection,
    clearSelection,
    isCellSelected,
    getSelectedCells,
    getSelectionBounds,
    extendSelection,
    selectRange,
  };
}
