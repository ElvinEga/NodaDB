import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettingsStore, Theme, FontSize, FontFamily } from "@/stores/settingsStore";

export function AppearanceSection() {
  const {
    theme,
    fontSize,
    fontFamily,
    setTheme,
    setFontSize,
    setFontFamily,
  } = useSettingsStore();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-base font-semibold tracking-tight">Appearance</h3>
        <p className="text-xs text-muted-foreground">
          Customize the visual theme, typography, and scaling of NodaDB.
        </p>
      </div>

      <div className="space-y-5 rounded-lg border border-border/60 bg-card/40 p-4">
        <div className="space-y-2">
          <Label htmlFor="theme">Interface Theme</Label>
          <Select value={theme} onValueChange={(v) => setTheme(v as Theme)}>
            <SelectTrigger id="theme">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="system">System Default</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Switch between light, dark, or system-synchronized appearance.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fontSize">Font Size</Label>
          <Select value={fontSize} onValueChange={(v) => setFontSize(v as FontSize)}>
            <SelectTrigger id="fontSize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="small">Small (Compact)</SelectItem>
              <SelectItem value="medium">Medium (Standard)</SelectItem>
              <SelectItem value="large">Large (Accessible)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Adjust overall application typography scaling.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fontFamily">Font Family</Label>
          <Select value={fontFamily} onValueChange={(v) => setFontFamily(v as FontFamily)}>
            <SelectTrigger id="fontFamily">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="System">System Default</SelectItem>
              <SelectItem value="Outfit">Outfit</SelectItem>
              <SelectItem value="JetBrains Mono">JetBrains Mono</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Choose the application font family.
          </p>
        </div>
      </div>
    </div>
  );
}
