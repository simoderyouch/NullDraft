"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  // HUD window control
  showHUD: () => electron.ipcRenderer.invoke("show-hud"),
  hideHUD: () => electron.ipcRenderer.invoke("hide-hud"),
  isHUDVisible: () => electron.ipcRenderer.invoke("is-hud-visible"),
  updateHUDData: (data) => electron.ipcRenderer.invoke("update-hud-data", data),
  // Window control
  closeWindow: () => electron.ipcRenderer.invoke("close-window"),
  hideWindow: () => electron.ipcRenderer.invoke("hide-window"),
  // Capture control
  captureScreenshot: () => electron.ipcRenderer.invoke("capture-screenshot"),
  skipStep: () => electron.ipcRenderer.invoke("skip-step"),
  // Listen for HUD data updates (from main window to HUD window)
  onHUDDataUpdate: (callback) => {
    electron.ipcRenderer.on("hud-data-update", (_event, data) => callback(data));
  },
  // Remove listeners
  removeHUDDataListener: () => {
    electron.ipcRenderer.removeAllListeners("hud-data-update");
  }
});
