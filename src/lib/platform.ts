export const IS_BROWSER = typeof window !== "undefined";

export const IS_MAC =
  IS_BROWSER &&
  (/Mac/.test(navigator.userAgent) ||
    /Mac/.test(navigator.platform ?? ""));

export const IS_WINDOWS =
  IS_BROWSER &&
  (/Win/.test(navigator.userAgent) ||
    /Win/.test(navigator.platform ?? ""));

export const IS_LINUX = IS_BROWSER && !IS_MAC && !IS_WINDOWS;

export const USE_CUSTOM_WINDOW_CONTROLS = !IS_MAC;
