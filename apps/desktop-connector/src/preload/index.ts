import type {
  DesktopActionResult,
  DesktopConnectorEventPayload,
  DesktopConnectorLogEventPayload,
  DesktopConnectorSettingsInput,
  DesktopConnectorSnapshot,
  DesktopPairingResult,
} from "@edgeintel/shared-contracts";
import { EDGEINTEL_DESKTOP_IPC } from "@edgeintel/shared-contracts";
import { contextBridge, ipcRenderer, shell } from "electron";

contextBridge.exposeInMainWorld("edgeIntelDesktop", {
  platform: process.platform,
  versions: process.versions,
  getSnapshot: () =>
    ipcRenderer.invoke(
      EDGEINTEL_DESKTOP_IPC.getSnapshot,
    ) as Promise<DesktopConnectorSnapshot>,
  pairConnector: (input: DesktopConnectorSettingsInput) =>
    ipcRenderer.invoke(
      EDGEINTEL_DESKTOP_IPC.pairConnector,
      input,
    ) as Promise<DesktopPairingResult>,
  refreshCloudflared: () =>
    ipcRenderer.invoke(
      EDGEINTEL_DESKTOP_IPC.refreshCloudflared,
    ) as Promise<DesktopActionResult>,
  installCloudflared: () =>
    ipcRenderer.invoke(
      EDGEINTEL_DESKTOP_IPC.installCloudflared,
    ) as Promise<DesktopActionResult>,
  testLocalService: () =>
    ipcRenderer.invoke(
      EDGEINTEL_DESKTOP_IPC.testLocalService,
    ) as Promise<DesktopActionResult>,
  startRuntime: () =>
    ipcRenderer.invoke(
      EDGEINTEL_DESKTOP_IPC.startRuntime,
    ) as Promise<DesktopActionResult>,
  stopRuntime: () =>
    ipcRenderer.invoke(
      EDGEINTEL_DESKTOP_IPC.stopRuntime,
    ) as Promise<DesktopActionResult>,
  updatePreferences: (input: Partial<DesktopConnectorSettingsInput>) =>
    ipcRenderer.invoke(
      EDGEINTEL_DESKTOP_IPC.updatePreferences,
      input,
    ) as Promise<DesktopActionResult>,
  resetConfiguration: () =>
    ipcRenderer.invoke(
      EDGEINTEL_DESKTOP_IPC.resetConfiguration,
    ) as Promise<DesktopActionResult>,
  openExternal: (url: string) => shell.openExternal(url),
  onSnapshot: (listener: (payload: DesktopConnectorEventPayload) => void) => {
    const handler = (_event: unknown, payload: DesktopConnectorEventPayload) =>
      listener(payload);
    ipcRenderer.on(EDGEINTEL_DESKTOP_IPC.onSnapshot, handler);
    return () => {
      ipcRenderer.removeListener(EDGEINTEL_DESKTOP_IPC.onSnapshot, handler);
    };
  },
  onLog: (listener: (payload: DesktopConnectorLogEventPayload) => void) => {
    const handler = (_event: unknown, payload: DesktopConnectorLogEventPayload) =>
      listener(payload);
    ipcRenderer.on(EDGEINTEL_DESKTOP_IPC.onLog, handler);
    return () => {
      ipcRenderer.removeListener(EDGEINTEL_DESKTOP_IPC.onLog, handler);
    };
  },
});
