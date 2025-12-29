import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
} from "@/components/ui/empty";
import { Tag as TagIcon, X, Tags } from "lucide-react";
import { TableTag, TagColor } from "@/types";
import {
  getTags,
  getTagForTable,
  assignTagToTable,
  removeTagFromTable,
} from "@/lib/tagStorage";
import { toast } from "sonner";

interface TagSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableName: string;
  connectionId: string;
  onTagChange?: () => void;
  onOpenTagManager?: () => void;
}

const colorClasses: Record<TagColor, string> = {
  red: "bg-red-500",
  orange: "bg-orange-500",
  amber: "bg-amber-500",
  yellow: "bg-yellow-500",
  lime: "bg-lime-500",
  green: "bg-green-500",
  emerald: "bg-emerald-500",
  teal: "bg-teal-500",
  cyan: "bg-cyan-500",
  sky: "bg-sky-500",
  blue: "bg-blue-500",
  indigo: "bg-indigo-500",
  violet: "bg-violet-500",
  purple: "bg-purple-500",
  fuchsia: "bg-fuchsia-500",
  pink: "bg-pink-500",
  rose: "bg-rose-500",
  slate: "bg-slate-500",
  gray: "bg-gray-500",
  zinc: "bg-zinc-500",
  neutral: "bg-neutral-500",
  stone: "bg-stone-500",
};

export function TagSelectDialog({
  open,
  onOpenChange,
  tableName,
  connectionId,
  onTagChange,
  onOpenTagManager,
}: TagSelectDialogProps) {
  const [tags, setTags] = useState<TableTag[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      const availableTags = getTags();
      setTags(availableTags);

      const currentTag = getTagForTable(tableName, connectionId);
      setSelectedTagId(currentTag?.id || null);
    }
  }, [open, tableName, connectionId]);

  const handleSave = () => {
    if (selectedTagId) {
      assignTagToTable(tableName, selectedTagId, connectionId);
    } else {
      removeTagFromTable(tableName, connectionId);
    }
    onTagChange?.();
    onOpenChange(false);
    toast.success("Tag updated successfully");
  };

  const handleRemoveTag = () => {
    removeTagFromTable(tableName, connectionId);
    setSelectedTagId(null);
    onTagChange?.();
    onOpenChange(false);
    toast.success("Tag removed successfully");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TagIcon className="h-5 w-5" />
            Assign Tag
          </DialogTitle>
          <DialogDescription>
            Select a tag for table &quot;{tableName}&quot; or leave untagged.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-2">
            {/* Untagged option */}
            <button
              onClick={() => setSelectedTagId(null)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                selectedTagId === null
                  ? "border-primary bg-primary/10"
                  : "border-border hover:bg-muted"
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-muted border border-border" />
              <span className="text-sm font-medium">Untagged</span>
            </button>

            {/* Tag options */}
            {tags.length === 0 ? (
              <Empty className="border-border/50 py-8">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Tags className="h-6 w-6" />
                  </EmptyMedia>
                  <EmptyTitle>No tags available</EmptyTitle>
                  <EmptyDescription>
                    Create tags in Tag Manager to organize your tables.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button
                    variant="default"
                    onClick={() => {
                      onOpenChange(false);
                      onOpenTagManager?.();
                    }}
                  >
                    <TagIcon className="h-4 w-4 mr-2" />
                    Open Tag Manager
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              tags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => setSelectedTagId(tag.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    selectedTagId === tag.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full ${colorClasses[tag.color]}`} />
                  <span className="text-sm font-medium">{tag.name}</span>
                </button>
              ))
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleRemoveTag}
            disabled={!selectedTagId}
            className="sm:mr-auto"
          >
            <X className="h-3.5 w-3.5 mr-1.5" />
            Remove Tag
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
