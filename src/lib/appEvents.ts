export const OPEN_ABOUT_EVENT = "nodadb:open-about";

export function emitOpenAboutEvent() {
  window.dispatchEvent(new CustomEvent(OPEN_ABOUT_EVENT));
}
