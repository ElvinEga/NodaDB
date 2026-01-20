import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// @ts-ignore - __TAURI__ is available in Tauri environment
async function setupApp() {
  // Setup native menu only on macOS
  if (typeof window !== "undefined" && (window as any).__TAURI__) {
    try {
      // Detect if running on macOS
      const isMacOS = navigator.userAgent.includes("Mac");

      if (isMacOS) {
        const { setupNativeMenu } = await import("./lib/nativeMenu");
        await setupNativeMenu();
      }
      // For Linux/Windows, the MenuBar will be rendered in App.tsx
    } catch (error) {
      console.error("Failed to setup native menu:", error);
    }
  }
}

setupApp();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

document.getElementById("loading")?.remove();
