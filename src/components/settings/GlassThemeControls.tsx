import React from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useSettingsStore } from "@/stores/settingsStore";
import { Sparkles, RotateCcw, Eye, Layers } from "lucide-react";

export function GlassThemeControls() {
  const { glassOpacity, setGlassOpacity, glassBlur, setGlassBlur } = useSettingsStore();

  const opacityPercent = Math.round(glassOpacity * 100);

  const handleReset = () => {
    setGlassOpacity(0.65);
    setGlassBlur(20);
  };

  return (
    <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4 backdrop-blur-sm animate-in fade-in-50 duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">

          <div>
            <h4 className="text-xs font-semibold text-foreground">Glass Customization</h4>
            <p className="text-[11px] text-muted-foreground">
              Adjust translucency and native blur intensity
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="h-7 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
          title="Reset glass controls to defaults"
        >
          <RotateCcw className="h-3 w-3" />
          <span>Reset Defaults</span>
        </Button>
      </div>

      {/* Surface Opacity Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Eye className="h-3.5 w-3.5 text-primary" />
            <Label className="text-xs cursor-pointer font-medium text-foreground">
              Surface Opacity
            </Label>
          </div>
          <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-secondary/80 border border-border text-foreground">
            {opacityPercent}%
          </span>
        </div>
        <Slider
          value={[opacityPercent]}
          min={10}
          max={95}
          step={1}
          onValueChange={([val]) => setGlassOpacity(val / 100)}
          className="py-1 cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>More Translucent (10%)</span>
          <span>More Solid (95%)</span>
        </div>
      </div>

      {/* Blur Radius Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Layers className="h-3.5 w-3.5 text-primary" />
            <Label className="text-xs cursor-pointer font-medium text-foreground">
              Blur Radius
            </Label>
          </div>
          <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-secondary/80 border border-border text-foreground">
            {glassBlur}px
          </span>
        </div>
        <Slider
          value={[glassBlur]}
          min={0}
          max={60}
          step={1}
          onValueChange={([val]) => setGlassBlur(val)}
          className="py-1 cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Sharp (0px)</span>
          <span>Frosted Diffusion (60px)</span>
        </div>
      </div>
    </div>
  );
}
