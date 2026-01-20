import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// @ts-ignore - __TAURI__ is available in Tauri environment
async function setupApp() {
  // Setup native menu on desktop
  if (typeof window !== 'undefined' && (window as any).__TAURI__) {
    try {
      const { setupNativeMenu } = await import("./lib/nativeMenu");
      await setupNativeMenu();
    } catch (error) {
      console.error("Failed to setup native menu:", error);
    }
  }
}

setupApp();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

document.getElementById('loading')?.remove();
