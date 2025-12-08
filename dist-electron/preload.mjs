import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("electronAPI", {
  // HUD window control
  showHUD: () => ipcRenderer.invoke("show-hud"),
  hideHUD: () => ipcRenderer.invoke("hide-hud"),
  isHUDVisible: () => ipcRenderer.invoke("is-hud-visible"),
  updateHUDData: (data) => ipcRenderer.invoke("update-hud-data", data),
  // Listen for HUD data updates (from main window to HUD window)
  onHUDDataUpdate: (callback) => {
    ipcRenderer.on("hud-data-update", (_event, data) => callback(data));
  },
  // Remove listeners
  removeHUDDataListener: () => {
    ipcRenderer.removeAllListeners("hud-data-update");
  }
});
