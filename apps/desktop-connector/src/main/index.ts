import { app, BrowserWindow } from "electron";
import { ConnectorService } from "./connector-service";
import { registerIpcHandlers } from "./ipc";
import { initAutoUpdater } from "./updater";
import { createMainWindow, markAppQuitting } from "./window";
import { createTray, destroyTray, updateTraySnapshot } from "./tray";

let mainWindow: BrowserWindow | null = null;
let service: ConnectorService | null = null;
let ipcRegistered = false;

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.on("ready", () => {
    mainWindow = createMainWindow();
    service = new ConnectorService();
    if (!ipcRegistered) {
      registerIpcHandlers(mainWindow, service);
      ipcRegistered = true;
    }
    service.on("snapshot", (snapshot) => {
      updateTraySnapshot(snapshot);
    });
    createTray(mainWindow);
    initAutoUpdater((entry) => {
      service?.logExternal(entry);
    });
    void service.initialize();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    } else {
      mainWindow?.show();
    }
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("before-quit", () => {
    markAppQuitting();
    destroyTray();
  });
}
