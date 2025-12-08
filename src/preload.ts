import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // HUD window control
  showHUD: () => ipcRenderer.invoke('show-hud'),
  hideHUD: () => ipcRenderer.invoke('hide-hud'),
  isHUDVisible: () => ipcRenderer.invoke('is-hud-visible'),
  updateHUDData: (data: any) => ipcRenderer.invoke('update-hud-data', data),
  
  // Window control
  closeWindow: () => ipcRenderer.invoke('close-window'),
  hideWindow: () => ipcRenderer.invoke('hide-window'),
  
  // Capture control
  captureScreenshot: () => ipcRenderer.invoke('capture-screenshot'),
  skipStep: () => ipcRenderer.invoke('skip-step'),
  
  // Listen for HUD data updates (from main window to HUD window)
  onHUDDataUpdate: (callback: (data: any) => void) => {
    ipcRenderer.on('hud-data-update', (_event, data) => callback(data))
  },
  
  // Remove listeners
  removeHUDDataListener: () => {
    ipcRenderer.removeAllListeners('hud-data-update')
  },
})


