import type {
  DesktopConnectorEventPayload,
  DesktopConnectorLogEventPayload,
  DesktopConnectorSettingsInput,
} from "@edgeintel/shared-contracts";
import { EDGEINTEL_DESKTOP_IPC } from "@edgeintel/shared-contracts";
import { BrowserWindow, ipcMain } from "electron";
import { ConnectorService } from "./connector-service";

export function registerIpcHandlers(mainWindow: BrowserWindow, service: ConnectorService): void {
  ipcMain.handle(EDGEINTEL_DESKTOP_IPC.getSnapshot, async () => service.getSnapshot());
  ipcMain.handle(EDGEINTEL_DESKTOP_IPC.pairConnector, async (_event, input: DesktopConnectorSettingsInput) =>
    service.pairConnector(input),
  );
  ipcMain.handle(EDGEINTEL_DESKTOP_IPC.refreshCloudflared, async () => service.refreshCloudflared());
  ipcMain.handle(EDGEINTEL_DESKTOP_IPC.installCloudflared, async () => service.installCloudflared());
  ipcMain.handle(EDGEINTEL_DESKTOP_IPC.testLocalService, async () => service.testLocalService());
  ipcMain.handle(EDGEINTEL_DESKTOP_IPC.startRuntime, async () => service.startRuntime());
  ipcMain.handle(EDGEINTEL_DESKTOP_IPC.stopRuntime, async () => service.stopRuntime());
  ipcMain.handle(EDGEINTEL_DESKTOP_IPC.updatePreferences, async (_event, input: Partial<DesktopConnectorSettingsInput>) =>
    service.updatePreferences(input),
  );
  ipcMain.handle(EDGEINTEL_DESKTOP_IPC.resetConfiguration, async () => service.resetConfiguration());

  service.on("snapshot", (snapshot) => {
    if (mainWindow.isDestroyed()) return;
    const payload: DesktopConnectorEventPayload = { snapshot };
    mainWindow.webContents.send(EDGEINTEL_DESKTOP_IPC.onSnapshot, payload);
  });

  service.on("log", (entry) => {
    if (mainWindow.isDestroyed()) return;
    const payload: DesktopConnectorLogEventPayload = { entry };
    mainWindow.webContents.send(EDGEINTEL_DESKTOP_IPC.onLog, payload);
  });
}
