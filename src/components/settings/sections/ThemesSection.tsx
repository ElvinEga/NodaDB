import { THEMES, ThemeDefinition } from "@/lib/themes";
import { useSettingsStore } from "@/stores/settingsStore";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThemeCardProps {
  theme: ThemeDefinition;
  selected: boolean;
  onSelect: (id: string) => void;
}

function ThemeCard({ theme, selected, onSelect }: ThemeCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(theme.id)}
      className={cn(
        "flex items-center gap-3 rounded-lg border p-3 text-left w-full transition-all duration-150",
        selected
          ? "border-primary ring-2 ring-primary/25 bg-accent/60"
          : "border-border hover:border-primary/40 hover:bg-accent/30"
      )}
    >
      <div
        className="flex gap-[3px] rounded-md p-1.5 shrink-0 border border-white/10"
        style={{ background: theme.previewColors[0] }}
      >
        {theme.previewColors.map((c, i) => (
          <div key={i} className="h-5 w-[7px] rounded-full" style={{ background: c }} />
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm truncate leading-tight">{theme.name}</p>
        <p className="text-xs text-muted-foreground truncate mt-0.5 leading-tight">
          {theme.description}
        </p>
      </div>
      {selected && <Check className="h-3.5 w-3.5 text-primary ml-auto shrink-0" />}
    </button>
  );
}

export function ThemesSection() {
  const { colorTheme, setColorTheme } = useSettingsStore();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-base font-semibold tracking-tight">Color Themes</h3>
        <p className="text-xs text-muted-foreground">
          Select a color palette. Themes automatically adapt to your Light/Dark Appearance setting.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {THEMES.map((t) => (
          <ThemeCard
            key={t.id}
            theme={t}
            selected={colorTheme === t.id}
            onSelect={setColorTheme}
          />
        ))}
      </div>
    </div>
  );
}
