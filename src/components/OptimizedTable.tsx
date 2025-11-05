import { useRef, useMemo, useEffect, useState } from "react";
import { TableHeader } from "@/lib/table-state";
import { useTableState } from "@/hooks/use-table-state";
import { cn } from "@/lib/utils";
import { useTableVirtualization } from "@/hooks/use-table-virtualization";
import { EditableCell } from "./EditableCell";
import { TableHeaderResizeHandle } from "./TableHeaderResizeHandle";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { toast } from "sonner";

interface OptimizedTableProps {
  headers: TableHeader[];
  data: Record<string, any>[];
}

interface ContextMenuTarget {
  y: number;
  x: number;
  event: React.MouseEvent;
}

export const OptimizedTable = ({ headers, data }: OptimizedTableProps) => {
  const state = useTableState(headers, data);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [contextMenuTarget, setContextMenuTarget] =
    useState<ContextMenuTarget | null>(null);

  const ROW_HEIGHT = 36;

  const { rowStartIndex, rowEndIndex, colStartIndex, colEndIndex } =
    useTableVirtualization({
      containerRef: tableContainerRef,
      totalRows: state.getRowCount(),
      totalColumns: state.getHeaders().length,
      rowHeight: ROW_HEIGHT,
      columnWidths: state.getColumnWidths(),
    });

  const totalHeight = state.getRowCount() * ROW_HEIGHT;
  const totalWidth = useMemo(
    () => state.getColumnWidths().reduce((sum, w) => sum + w, 0),
    [state]
  );

  const headersToRender = useMemo(
    () => state.getHeaders().slice(colStartIndex, colEndIndex + 1),
    [state, colStartIndex, colEndIndex]
  );
  const rowsToRender = useMemo(
    () => state.getRows().slice(rowStartIndex, rowEndIndex + 1),
    [state, rowStartIndex, rowEndIndex]
  );

  const paddingTop = rowStartIndex * ROW_HEIGHT;
  const paddingLeft = useMemo(() => {
    return state
      .getColumnWidths()
      .slice(0, colStartIndex)
      .reduce((sum, w) => sum + w, 0);
  }, [state, colStartIndex]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).tagName === "INPUT") return;

    switch (e.key) {
      case "ArrowUp":
        state.moveFocus(-1, 0);
        break;
      case "ArrowDown":
        state.moveFocus(1, 0);
        break;
      case "ArrowLeft":
        state.moveFocus(0, -1);
        break;
      case "ArrowRight":
        state.moveFocus(0, 1);
        break;
      case "Enter":
      case "F2":
        state.enterEditMode();
        break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          state.enterEditMode();
        }
        return;
    }
    e.preventDefault();
  };

  useEffect(() => {
    const focus = state.getFocus();
    const container = tableContainerRef.current;
    if (!focus || !container) return;

    const cellTop = focus.y * ROW_HEIGHT;
    const cellBottom = cellTop + ROW_HEIGHT;
    if (cellTop < container.scrollTop) {
      container.scrollTop = cellTop;
    }
    if (cellBottom > container.scrollTop + container.clientHeight) {
      container.scrollTop = cellBottom - container.clientHeight;
    }
  }, [state]);

  return (
    <ContextMenu onOpenChange={(open) => !open && setContextMenuTarget(null)}>
      <ContextMenuTrigger asChild>
        <div
          ref={tableContainerRef}
          className="h-full w-full overflow-auto border focus:outline-none"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          style={{ contain: "strict" }}
        >
          <div
            style={{
              height: `${totalHeight}px`,
              width: `${totalWidth}px`,
              position: "relative",
            }}
          >
            <table
              className="border-collapse"
              style={{
                position: "absolute",
                top: `${paddingTop}px`,
                left: `${paddingLeft}px`,
              }}
            >
              <thead className="sticky top-0 bg-secondary z-10">
                <tr>
                  {headersToRender.map((header, i) => {
                    const x = colStartIndex + i;
                    return (
                      <th
                        key={header.name}
                        className="border p-2 text-left text-sm relative group"
                        style={{ width: `${state.getColumnWidths()[x]}px` }}
                      >
                        {header.name}
                        <TableHeaderResizeHandle
                          initialWidth={state.getColumnWidths()[x]}
                          onResize={(newWidth) =>
                            state.setHeaderWidth(x, newWidth)
                          }
                        />
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rowsToRender.map((row, i) => {
                  const y = rowStartIndex + i;
                  return (
                    <tr key={y} style={{ height: `${ROW_HEIGHT}px` }}>
                      {headersToRender.map((header, j) => {
                        const x = colStartIndex + j;
                        const isFocused =
                          state.getFocus()?.y === y &&
                          state.getFocus()?.x === x;
                        const isSelected = state.isCellSelected(y, x);
                        const isEditing =
                          state.getEditingCell()?.y === y &&
                          state.getEditingCell()?.x === x;
                        const hasChange =
                          row.change && header.name in row.change;

                        return (
                          <td
                            key={x}
                            className={cn(
                              "border p-2 text-xs font-mono select-none overflow-hidden whitespace-nowrap text-ellipsis relative",
                              {
                                "bg-blue-100 dark:bg-blue-900": isSelected,
                                "ring-2 ring-blue-500 ring-inset z-10":
                                  isFocused,
                                "bg-yellow-100 dark:bg-yellow-900/50":
                                  hasChange,
                              }
                            )}
                            style={{ width: `${state.getColumnWidths()[x]}px` }}
                            onMouseDown={() => state.setFocus(y, x)}
                            onMouseMove={(e) => {
                              if (e.buttons === 1) state.setSelection(y, x);
                            }}
                            onDoubleClick={() => state.enterEditMode(y, x)}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              setContextMenuTarget({ y, x, event: e });
                              if (
                                state.getFocus()?.y !== y ||
                                state.getFocus()?.x !== x
                              ) {
                                state.setFocus(y, x);
                              }
                            }}
                          >
                            {isEditing ? (
                              <EditableCell
                                initialValue={state.getValue(y, x)}
                                state={state}
                                y={y}
                                x={x}
                              />
                            ) : (
                              <>
                                {String(state.getValue(y, x) ?? "NULL")}
                                {hasChange && (
                                  <div className="absolute top-0 left-0 w-0 h-0 border-t-8 border-t-yellow-400 border-r-8 border-r-transparent" />
                                )}
                              </>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </ContextMenuTrigger>

      {contextMenuTarget && (
        <ContextMenuContent>
          <ContextMenuItem
            onSelect={() => {
              const { y, x } = contextMenuTarget;
              const value = state.getValue(y, x);
              navigator.clipboard.writeText(String(value ?? ""));
              toast.success("Cell value copied");
            }}
          >
            Copy Cell
          </ContextMenuItem>

          <ContextMenuItem
            onSelect={() => {
              const { y } = contextMenuTarget;
              const row = state.getRows()[y].raw;
              navigator.clipboard.writeText(JSON.stringify(row, null, 2));
              toast.success("Row copied as JSON");
            }}
          >
            Copy Row as JSON
          </ContextMenuItem>

          <ContextMenuSeparator />

          <ContextMenuItem
            onSelect={() => {
              const { y, x } = contextMenuTarget;
              state.enterEditMode(y, x);
            }}
          >
            Edit Cell
          </ContextMenuItem>
        </ContextMenuContent>
      )}
    </ContextMenu>
  );
};
