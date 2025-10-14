import { useCallback } from 'react';
import { toast } from 'sonner';

export interface ClipboardData {
  rows: string[][];
  source: 'copy' | 'cut';
}

export function useCellClipboard() {
  // Copy cells to clipboard
  const copyCells = useCallback(async (data: any[][], columnNames: string[]) => {
    try {
      // Convert data to TSV format (Tab-Separated Values) for Excel compatibility
      const tsvData = data.map(row => row.map(cell => {
        if (cell === null || cell === undefined) return '';
        return String(cell);
      }).join('\t')).join('\n');

      // Also store as HTML table for richer paste
      const htmlTable = `<table><thead><tr>${columnNames.map(name => `<th>${name}</th>`).join('')}</tr></thead><tbody>${
        data.map(row => `<tr>${row.map(cell => `<td>${cell === null || cell === undefined ? '' : String(cell)}</td>`).join('')}</tr>`).join('')
      }</tbody></table>`;

      // Use Clipboard API if available
      if (navigator.clipboard && window.ClipboardItem) {
        const items = [
          new ClipboardItem({
            'text/plain': new Blob([tsvData], { type: 'text/plain' }),
            'text/html': new Blob([htmlTable], { type: 'text/html' }),
          }),
        ];
        await navigator.clipboard.write(items);
      } else {
        // Fallback for older browsers
        await navigator.clipboard.writeText(tsvData);
      }

      toast.success(`Copied ${data.length} row(s) × ${data[0]?.length || 0} column(s)`);
      return true;
    } catch (error) {
      toast.error(`Failed to copy: ${error}`);
      console.error('Copy error:', error);
      return false;
    }
  }, []);

  // Parse clipboard data
  const parseClipboardData = useCallback((text: string): string[][] => {
    // Split by newlines and tabs to create 2D array
    const rows = text.split(/\r?\n/).filter(row => row.length > 0);
    return rows.map(row => row.split('\t'));
  }, []);

  // Paste cells from clipboard
  const pasteCells = useCallback(async (): Promise<string[][] | null> => {
    try {
      if (!navigator.clipboard) {
        toast.error('Clipboard API not available');
        return null;
      }

      const text = await navigator.clipboard.readText();
      if (!text) {
        toast.error('Clipboard is empty');
        return null;
      }

      const data = parseClipboardData(text);
      toast.info(`Pasting ${data.length} row(s) × ${data[0]?.length || 0} column(s)`);
      return data;
    } catch (error) {
      toast.error(`Failed to paste: ${error}`);
      console.error('Paste error:', error);
      return null;
    }
  }, [parseClipboardData]);

  // Export selection as CSV
  const exportAsCSV = useCallback((data: any[][], columnNames: string[], filename: string = 'export.csv') => {
    try {
      // Convert to CSV format
      const csvData = [
        columnNames.join(','),
        ...data.map(row =>
          row.map(cell => {
            if (cell === null || cell === undefined) return '';
            const str = String(cell);
            // Escape quotes and wrap in quotes if contains comma, quote, or newline
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          }).join(',')
        )
      ].join('\n');

      // Create blob and download
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Exported ${data.length} rows to ${filename}`);
      return true;
    } catch (error) {
      toast.error(`Failed to export: ${error}`);
      console.error('Export error:', error);
      return false;
    }
  }, []);

  return {
    copyCells,
    pasteCells,
    parseClipboardData,
    exportAsCSV,
  };
}
