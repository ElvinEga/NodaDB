import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { getSubWindowComponent } from "./components/WindowRouter";
import "./index.css";

const SubWindowComponent = getSubWindowComponent();

if (SubWindowComponent) {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <SubWindowComponent />
    </React.StrictMode>
  );
  document.getElementById("loading")?.remove();
} else {
  async function setupApp() {
    // Setup native menu only on macOS
    if (typeof window !== "undefined" && "__TAURI__" in window) {
      try {
        const isMacOS = navigator.userAgent.includes("Mac");

        if (isMacOS) {
          const { setupNativeMenu } = await import("./lib/nativeMenu");
          const { exit } = await import("@tauri-apps/plugin-process");
          await setupNativeMenu();

          window.addEventListener("keydown", (event) => {
            if (event.metaKey && event.key.toLowerCase() === "q") {
              event.preventDefault();
              void exit(0);
            }
          });
        }
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
}
