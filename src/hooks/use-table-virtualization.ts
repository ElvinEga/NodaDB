import { useState, useEffect, useCallback, RefObject } from 'react';

interface VirtualizationOptions {
  containerRef: RefObject<HTMLElement>;
  totalRows: number;
  totalColumns: number;
  rowHeight: number;
  columnWidths: number[];
  overscan?: number;
}

interface VirtualizationState {
  rowStartIndex: number;
  rowEndIndex: number;
  colStartIndex: number;
  colEndIndex: number;
}

export const useTableVirtualization = ({
  containerRef,
  totalRows,
  totalColumns,
  rowHeight,
  columnWidths,
  overscan = 10,
}: VirtualizationOptions) => {
  const [range, setRange] = useState<VirtualizationState>({
    rowStartIndex: 0,
    rowEndIndex: 0,
    colStartIndex: 0,
    colEndIndex: 0,
  });

  const calculateRange = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollTop, clientHeight } = container;
    const rowStartIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const visibleRowCount = Math.ceil(clientHeight / rowHeight);
    const rowEndIndex = Math.min(totalRows - 1, rowStartIndex + visibleRowCount + (overscan * 2));

    const { scrollLeft, clientWidth } = container;
    let colStartIndex = -1;
    let colEndIndex = -1;
    let accumulatedWidth = 0;

    for (let i = 0; i < totalColumns; i++) {
      const colWidth = columnWidths[i] || 150;

      if (accumulatedWidth + colWidth > scrollLeft && colStartIndex === -1) {
        colStartIndex = Math.max(0, i - overscan);
      }
      
      if (accumulatedWidth > scrollLeft + clientWidth && colEndIndex === -1) {
        colEndIndex = Math.min(totalColumns - 1, i + overscan);
        break;
      }
      
      accumulatedWidth += colWidth;
    }
    
    if (colEndIndex === -1) {
      colEndIndex = totalColumns - 1;
    }

    setRange({ rowStartIndex, rowEndIndex, colStartIndex, colEndIndex });

  }, [containerRef, totalRows, totalColumns, rowHeight, columnWidths, overscan]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    calculateRange();

    const handleScroll = () => requestAnimationFrame(calculateRange);

    container.addEventListener('scroll', handleScroll);

    const resizeObserver = new ResizeObserver(calculateRange);
    resizeObserver.observe(container);
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
      resizeObserver.unobserve(container);
    };
  }, [calculateRange]);

  return range;
};
