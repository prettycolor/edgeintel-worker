import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("edgeIntelDesktop", {
  platform: process.platform,
  versions: process.versions,
});
