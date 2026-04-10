import { BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createMainWindow() {
  const window = new BrowserWindow({
    width: 1220,
    height: 860,
    minWidth: 1080,
    minHeight: 760,
    title: "EdgeIntel Connector",
    backgroundColor: "#0f141b",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void window.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  return window;
}
