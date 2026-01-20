import {
  Menu,
  Submenu,
  MenuItem,
  PredefinedMenuItem,
} from "@tauri-apps/api/menu";
import { invoke } from "@tauri-apps/api/core";

export async function setupNativeMenu(): Promise<void> {
  const app = await import("@tauri-apps/api/app");

  // About submenu for macOS
  const aboutSubmenu = await Submenu.new({
    text: "About",
    items: [
      await MenuItem.new({
        id: "about",
        text: "About NodaDB",
        action: async () => {
          alert(
            "NodaDB v0.1.2\n\nA modern database management tool built with Tauri 2, React, and Rust."
          );
        },
      }),
    ],
  });

  // File menu
  const fileSubmenu = await Submenu.new({
    text: "File",
    items: [
      await MenuItem.new({
        id: "new-connection",
        text: "New Connection",
        action: async () => {
          await invoke("open_connection_dialog");
        },
      }),
      await MenuItem.new({
        id: "new-query",
        text: "New Query",
        action: async () => {
          await invoke("open_new_query_tab");
        },
      }),
      await PredefinedMenuItem.new({ item: "Separator", text: "" }),
      await MenuItem.new({
        id: "save-query",
        text: "Save Query",
        action: async () => {
          await invoke("save_current_query");
        },
      }),
      await MenuItem.new({
        id: "export-data",
        text: "Export Data",
        action: async () => {
          await invoke("open_export_dialog");
        },
      }),
      await PredefinedMenuItem.new({ item: "Separator", text: "" }),
      await MenuItem.new({
        id: "new-window",
        text: "New Window",
        action: async () => {
          await invoke("create_new_window");
        },
      }),
      await PredefinedMenuItem.new({ item: "Separator", text: "" }),
      await PredefinedMenuItem.new({
        item: "CloseWindow",
        text: "Close Window",
      }),
    ],
  });

  // Edit menu
  const editSubmenu = await Submenu.new({
    text: "Edit",
    items: [
      await PredefinedMenuItem.new({ item: "Undo", text: "Undo" }),
      await PredefinedMenuItem.new({ item: "Redo", text: "Redo" }),
      await PredefinedMenuItem.new({ item: "Separator", text: "" }),
      await PredefinedMenuItem.new({ item: "Cut", text: "Cut" }),
      await PredefinedMenuItem.new({ item: "Copy", text: "Copy" }),
      await PredefinedMenuItem.new({ item: "Paste", text: "Paste" }),
      await PredefinedMenuItem.new({ item: "SelectAll", text: "Select All" }),
      await PredefinedMenuItem.new({ item: "Separator", text: "" }),
      await MenuItem.new({
        id: "find",
        text: "Find",
        action: async () => {
          await invoke("toggle_find_dialog");
        },
      }),
      await MenuItem.new({
        id: "replace",
        text: "Replace",
        action: async () => {
          await invoke("toggle_replace_dialog");
        },
      }),
    ],
  });

  // Selection menu
  const selectionSubmenu = await Submenu.new({
    text: "Selection",
    items: [
      await MenuItem.new({
        id: "expand-selection",
        text: "Expand Selection",
        action: async () => {
          await invoke("expand_selection");
        },
      }),
      await MenuItem.new({
        id: "shrink-selection",
        text: "Shrink Selection",
        action: async () => {
          await invoke("shrink_selection");
        },
      }),
      await PredefinedMenuItem.new({ item: "Separator", text: "" }),
      await MenuItem.new({
        id: "copy-line-up",
        text: "Copy Line Up",
        action: async () => {
          await invoke("copy_line_up");
        },
      }),
      await MenuItem.new({
        id: "copy-line-down",
        text: "Copy Line Down",
        action: async () => {
          await invoke("copy_line_down");
        },
      }),
      await PredefinedMenuItem.new({ item: "Separator", text: "" }),
      await MenuItem.new({
        id: "column-selection",
        text: "Column Selection",
        action: async () => {
          await invoke("toggle_column_selection");
        },
      }),
    ],
  });

  // View menu
  const viewSubmenu = await Submenu.new({
    text: "View",
    items: [
      await MenuItem.new({
        id: "query-builder",
        text: "Query Builder",
        action: async () => {
          await invoke("open_query_builder");
        },
      }),
      await MenuItem.new({
        id: "schema-designer",
        text: "Schema Designer",
        action: async () => {
          await invoke("open_schema_designer");
        },
      }),
      await PredefinedMenuItem.new({ item: "Separator", text: "" }),
      await MenuItem.new({
        id: "toggle-sidebar",
        text: "Toggle Sidebar",
        action: async () => {
          await invoke("toggle_sidebar");
        },
      }),
      await MenuItem.new({
        id: "toggle-history",
        text: "Toggle Query History",
        action: async () => {
          await invoke("toggle_query_history");
        },
      }),
      await PredefinedMenuItem.new({ item: "Separator", text: "" }),
      await MenuItem.new({
        id: "toggle-theme",
        text: "Toggle Dark/Light Mode",
        action: async () => {
          document.documentElement.classList.toggle("dark");
          const isDark = document.documentElement.classList.contains("dark");
          await invoke("save_theme_preference", { isDark });
        },
      }),
    ],
  });

  // Help menu
  const helpSubmenu = await Submenu.new({
    text: "Help",
    items: [
      await MenuItem.new({
        id: "keyboard-shortcuts",
        text: "Keyboard Shortcuts",
        action: async () => {
          await invoke("show_keyboard_shortcuts");
        },
      }),
      await MenuItem.new({
        id: "documentation",
        text: "Documentation",
        action: async () => {
          await invoke("open_documentation");
        },
      }),
      await MenuItem.new({
        id: "github",
        text: "GitHub Repository",
        action: async () => {
          await invoke("open_github");
        },
      }),
      await MenuItem.new({
        id: "about",
        text: "About NodaDB",
        action: async () => {
          alert(
            "NodaDB v0.1.2\n\nA modern database management tool built with Tauri 2, React, and Rust."
          );
        },
      }),
    ],
  });

  const menu = await Menu.new({
    items: [
      aboutSubmenu,
      fileSubmenu,
      editSubmenu,
      selectionSubmenu,
      viewSubmenu,
      helpSubmenu,
    ],
  });

  await menu.setAsAppMenu();
}
