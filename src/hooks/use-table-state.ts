import { useState, useEffect, useMemo } from 'react';
import { TableState, TableHeader } from '@/lib/table-state';

export const useTableState = (headers: TableHeader[], data: Record<string, any>[]) => {
  const tableState = useMemo(() => new TableState(headers, data), [headers, data]);

  const [, setRevision] = useState(0);

  useEffect(() => {
    const onChange = () => {
      setRevision(r => r + 1);
    };

    tableState.addChangeListener(onChange);
    return () => {
      tableState.removeChangeListener(onChange);
    };
  }, [tableState]);

  return tableState;
};
