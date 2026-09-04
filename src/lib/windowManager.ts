import { invoke } from "@tauri-apps/api/core";

export interface SubWindowConfig {
  label: string;
  title: string;
  route: string;
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
  resizable?: boolean;
}

export async function openSubWindow(config: SubWindowConfig): Promise<void> {
  try {
    await invoke("open_sub_window", {
      options: {
        label: config.label,
        title: config.title,
        route: config.route,
        width: config.width,
        height: config.height,
        min_width: config.minWidth,
        min_height: config.minHeight,
        resizable: config.resizable,
      },
    });
  } catch (error) {
    console.error(`Failed to open window '${config.label}':`, error);
  }
}

/**
 * Open the Settings desktop window.
 * If already open, brings it to focus and switches to the specified tab if provided.
 */
export async function openSettingsWindow(tab?: string): Promise<void> {
  const route = tab ? `settings&tab=${encodeURIComponent(tab)}` : "settings";
  await openSubWindow({
    label: "settings",
    title: "Settings & Preferences",
    route,
    width: 920,
    height: 660,
    minWidth: 720,
    minHeight: 500,
    resizable: true,
  });
}
