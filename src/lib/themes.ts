export interface ThemeDefinition {
  id: string;
  name: string;
  description: string;
  previewColors: [string, string, string]; // [bg, mid, accent]
}

export const THEMES: ThemeDefinition[] = [
  {
    id: "default",
    name: "NodaDB Default",
    description: "Clean emerald green on neutral dark.",
    previewColors: ["#121212", "#1e1e1e", "#4ade80"],
  },
  {
    id: "one-dark-pro",
    name: "One Dark Pro",
    description: "Atom-inspired rich dark palette.",
    previewColors: ["#282c34", "#21252b", "#61afef"],
  },
  {
    id: "nord",
    name: "Nord",
    description: "Arctic, north-bluish palette.",
    previewColors: ["#2e3440", "#3b4252", "#88c0d0"],
  },
  {
    id: "claude",
    name: "Claude",
    description: "Warm clay accent on rich dark.",
    previewColors: ["#1a1512", "#231e18", "#d4715a"],
  },
  {
    id: "tokyo-night",
    name: "Tokyo Night",
    description: "Calm, deep-navy with violet accents.",
    previewColors: ["#1a1b2e", "#16213e", "#7aa2f7"],
  },
  {
    id: "catppuccin",
    name: "Catppuccin",
    description: "Mocha + Latte — soothing pastels.",
    previewColors: ["#1e1e2e", "#181825", "#cba6f7"],
  },
  {
    id: "dracula",
    name: "Dracula",
    description: "High-contrast purple dark theme.",
    previewColors: ["#282a36", "#1e1f29", "#bd93f9"],
  },
  {
    id: "gruvbox",
    name: "Gruvbox",
    description: "Warm, earthy retro palette.",
    previewColors: ["#282828", "#1d2021", "#fabd2f"],
  },
  {
    id: "rose-pine",
    name: "Rosé Pine",
    description: "Soho vibes, pine and rose.",
    previewColors: ["#191724", "#1f1d2e", "#ebbcba"],
  },
  {
    id: "solarized",
    name: "Solarized",
    description: "Ethan Schoonover's precision palette.",
    previewColors: ["#002b36", "#073642", "#2aa198"],
  },
];
