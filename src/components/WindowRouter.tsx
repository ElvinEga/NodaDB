import { ComponentType } from "react";
import { SettingsApp } from "@/components/settings/SettingsApp";

export const SUB_WINDOW_REGISTRY: Record<string, ComponentType> = {
  settings: SettingsApp,
};

export function getSubWindowComponent(): ComponentType | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const windowKey = params.get("window");
  if (!windowKey) return null;

  const baseKey = windowKey.split(/[?&]/)[0];
  return SUB_WINDOW_REGISTRY[baseKey] || null;
}
