import type { DesktopConnectorLogEntry } from "@edgeintel/shared-contracts";
import { autoUpdater } from "electron-updater";

export function initAutoUpdater(log: (entry: Omit<DesktopConnectorLogEntry, "id" | "timestamp">) => void): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    log({
      level: "info",
      scope: "updater",
      message: `Desktop update ${info.version} is available.`,
      detail: null,
    });
  });

  autoUpdater.on("update-downloaded", () => {
    log({
      level: "info",
      scope: "updater",
      message: "Desktop update downloaded and ready to install on quit.",
      detail: null,
    });
  });

  autoUpdater.on("error", (error) => {
    log({
      level: "warning",
      scope: "updater",
      message: "Auto-update check failed.",
      detail: error.message,
    });
  });

  void autoUpdater.checkForUpdates().catch(() => {});
}
