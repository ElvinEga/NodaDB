import {
  Table,
  MoreVertical,
  FileCode,
  Edit,
  Trash2,
  Tag as TagIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DatabaseTable } from "@/types";

interface TableRowProps {
  table: DatabaseTable;
  selectedTable: DatabaseTable | null;
  onTableSelect: (table: DatabaseTable) => void;
  setTableToExport: (table: DatabaseTable) => void;
  setExportDialogOpen: (open: boolean) => void;
  handleRenameTable: (name: string) => void;
  setTableForTag: (name: string) => void;
  setTagSelectOpen: (open: boolean) => void;
  handleDropTable: (name: string) => void;
  formatRowCount: (count?: number) => string;
  formatSize: (sizeKb?: number) => string;
}

export function TableRow({
  table,
  selectedTable,
  onTableSelect,
  setTableToExport,
  setExportDialogOpen,
  handleRenameTable,
  setTableForTag,
  setTagSelectOpen,
  handleDropTable,
  formatRowCount,
  formatSize,
}: TableRowProps) {
  return (
    <div className="flex items-center gap-1 group">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => onTableSelect(table)}
            className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
              selectedTable?.name === table.name
                ? "bg-primary text-primary-foreground font-extrabold"
                : "hover:bg-muted"
            }`}
          >
            <Table className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{table.name}</span>
            {table.table_type === "VIEW" && (
              <span className="ml-auto text-[10px] px-1 py-0.5 rounded bg-secondary text-muted-foreground">
                VIEW
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          <div className="space-y-1">
            <div className="font-semibold">{table.name}</div>
            <div className="text-muted-foreground">
              Type: {table.table_type || "TABLE"}
            </div>
            <div className="text-muted-foreground">
              Rows: {formatRowCount(table.row_count)}
            </div>
            {table.size_kb !== undefined && (
              <div className="text-muted-foreground">
                Size: {formatSize(table.size_kb)}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
          >
            <MoreVertical className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onTableSelect(table)}>
            <Table className="h-4 w-4 mr-2" />
            View Data
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setTableToExport(table);
              setExportDialogOpen(true);
            }}
          >
            <FileCode className="h-4 w-4 mr-2" />
            Export Structure
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleRenameTable(table.name)}>
            <Edit className="h-4 w-4 mr-2" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setTableForTag(table.name);
              setTagSelectOpen(true);
            }}
          >
            <TagIcon className="h-4 w-4 mr-2" />
            Assign Tag
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => handleDropTable(table.name)}
            className="text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Drop Table
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
