import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettingsStore } from "@/stores/settingsStore";

export function TableSection() {
  const {
    rowsPerPage,
    showRowNumbers,
    setRowsPerPage,
    setShowRowNumbers,
  } = useSettingsStore();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-base font-semibold tracking-tight">Table & Data Viewer</h3>
        <p className="text-xs text-muted-foreground">
          Customize pagination and row rendering for database table views.
        </p>
      </div>

      <div className="space-y-5 rounded-lg border border-border/60 bg-card/40 p-4">
        <div className="space-y-2">
          <Label htmlFor="rowsPerPage">Default Rows Per Page</Label>
          <Select
            value={rowsPerPage.toString()}
            onValueChange={(v) => setRowsPerPage(Number(v))}
          >
            <SelectTrigger id="rowsPerPage">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 rows</SelectItem>
              <SelectItem value="25">25 rows</SelectItem>
              <SelectItem value="50">50 rows</SelectItem>
              <SelectItem value="100">100 rows</SelectItem>
              <SelectItem value="200">200 rows</SelectItem>
              <SelectItem value="500">500 rows</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Default number of records loaded per page in table and query viewers
          </p>
        </div>

        <div className="pt-2 border-t border-border/40 flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">Show Row Numbers</Label>
            <p className="text-xs text-muted-foreground">
              Display sequential 1-based row index numbers on the left of table grids
            </p>
          </div>
          <Switch
            checked={showRowNumbers}
            onCheckedChange={setShowRowNumbers}
          />
        </div>
      </div>
    </div>
  );
}
