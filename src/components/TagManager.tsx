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
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tag as TagIcon, Plus, Trash2, Edit2, Check, X } from "lucide-react";
import { TableTag, TagColor } from "@/types";
import {
  getTags,
  createTag,
  updateTag,
  deleteTag,
} from "@/lib/tagStorage";
import { toast } from "sonner";

interface TagManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTagsChange?: () => void;
}

const TAG_COLORS: TagColor[] = [
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
  "slate",
  "gray",
  "zinc",
];

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

export function TagManager({ open, onOpenChange, onTagsChange }: TagManagerProps) {
  const [tags, setTags] = useState<TableTag[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [selectedColor, setSelectedColor] = useState<TagColor>("blue");
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState<TagColor>("blue");

  useEffect(() => {
    if (open) {
      setTags(getTags());
    }
  }, [open]);

  const handleCreateTag = () => {
    if (!newTagName.trim()) {
      toast.error("Please enter a tag name");
      return;
    }

    createTag(newTagName.trim(), selectedColor);
    setTags(getTags());
    setNewTagName("");
    setSelectedColor("blue");
    setIsCreating(false);
    onTagsChange?.();
    toast.success("Tag created successfully");
  };

  const handleUpdateTag = (id: string) => {
    if (!editName.trim()) {
      toast.error("Please enter a tag name");
      return;
    }

    updateTag(id, editName.trim(), editColor);
    setTags(getTags());
    setEditingId(null);
    onTagsChange?.();
    toast.success("Tag updated successfully");
  };

  const handleDeleteTag = (id: string) => {
    if (!confirm("Are you sure you want to delete this tag? Tables with this tag will become untagged.")) {
      return;
    }

    deleteTag(id);
    setTags(getTags());
    onTagsChange?.();
    toast.success("Tag deleted successfully");
  };

  const startEdit = (tag: TableTag) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditColor("blue");
  };

  const cancelCreate = () => {
    setIsCreating(false);
    setNewTagName("");
    setSelectedColor("blue");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TagIcon className="h-5 w-5" />
            Manage Tags
          </DialogTitle>
          <DialogDescription>
            Create, edit, and delete tags to organize your tables.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-2">
            {/* Create new tag section */}
            {isCreating ? (
              <div className="p-3 border border-dashed border-border rounded-lg space-y-3">
                <Input
                  placeholder="Tag name..."
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="h-8"
                  autoFocus
                />
                <div className="flex flex-wrap gap-1.5">
                  {TAG_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`w-6 h-6 rounded-full ${colorClasses[color]} ${
                        selectedColor === color ? "ring-2 ring-offset-2 ring-primary" : ""
                      }`}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleCreateTag} className="flex-1">
                    <Check className="h-3.5 w-3.5 mr-1" />
                    Create
                  </Button>
                  <Button size="sm" variant="outline" onClick={cancelCreate} className="flex-1">
                    <X className="h-3.5 w-3.5 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full border-dashed"
                onClick={() => setIsCreating(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-2" />
                Create New Tag
              </Button>
            )}

            {/* Tags list */}
            <div className="space-y-1 mt-3">
              {tags.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No tags yet. Create your first tag to get started.
                </div>
              ) : (
                tags.map((tag) => (
                  <div
                    key={tag.id}
                    className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    {editingId === tag.id ? (
                      <>
                        <div className={`w-4 h-4 rounded-full ${colorClasses[editColor]} flex-shrink-0`} />
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 h-7"
                        />
                        <div className="flex gap-0.5">
                          {TAG_COLORS.slice(0, 10).map((color) => (
                            <button
                              key={color}
                              onClick={() => setEditColor(color)}
                              className={`w-4 h-4 rounded-full ${colorClasses[color]} ${
                                editColor === color ? "ring-1 ring-offset-1 ring-primary" : ""
                              }`}
                            />
                          ))}
                        </div>
                        <Button size="sm" onClick={() => handleUpdateTag(tag.id)} className="h-7 px-2">
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={cancelEdit}
                          className="h-7 px-2"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className={`w-4 h-4 rounded-full ${colorClasses[tag.color]} flex-shrink-0`} />
                        <span className="flex-1 text-sm font-medium">{tag.name}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEdit(tag)}
                          className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100"
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteTag(tag.id)}
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
