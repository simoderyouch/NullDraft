import { contextBridge, ipcRenderer } from 'electron'

// Step info for capture
interface StepInfo {
  projectPath: string
  stepNumber: number
  stepTitle: string
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // HUD window control
  showHUD: () => ipcRenderer.invoke('show-hud'),
  hideHUD: () => ipcRenderer.invoke('hide-hud'),
  isHUDVisible: () => ipcRenderer.invoke('is-hud-visible'),
  updateHUDData: (data: any) => ipcRenderer.invoke('update-hud-data', data),
  getHUDData: () => ipcRenderer.invoke('get-hud-data'),

  // Window control
  closeWindow: () => ipcRenderer.invoke('close-window'),
  hideWindow: () => ipcRenderer.invoke('hide-window'),
  showWindow: () => ipcRenderer.invoke('show-window'),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),

  // Capture control (now accepts optional step info)
  captureScreenshot: (stepInfo?: StepInfo) => ipcRenderer.invoke('capture-screenshot', stepInfo),
  skipStep: () => ipcRenderer.invoke('skip-step'),
  backStep: () => ipcRenderer.invoke('back-step'),

  // Project management
  initProject: (projectName: string) => ipcRenderer.invoke('init-project', projectName),
  saveProjectManifest: (data: { projectPath: string; manifest: object }) =>
    ipcRenderer.invoke('save-project-manifest', data),
  getRecentProjects: () => ipcRenderer.invoke('get-recent-projects'),
  loadProject: (projectPath: string) => ipcRenderer.invoke('load-project', projectPath),

  // Listen for HUD data updates (from main window to HUD window)
  onHUDDataUpdate: (callback: (data: any) => void) => {
    ipcRenderer.on('hud-data-update', (_event, data) => callback(data))
  },

  // Remove listeners
  removeHUDDataListener: () => {
    ipcRenderer.removeAllListeners('hud-data-update')
  },

  // Listen for capture success events
  onCaptureSuccess: (callback: (data: { filepath: string; filename: string }) => void) => {
    ipcRenderer.on('capture-success', (_event, data) => callback(data))
  },

  // Remove capture success listener
  removeCaptureSuccessListener: () => {
    ipcRenderer.removeAllListeners('capture-success')
  },

  // Listen for step captured events (for auto-advancing)
  onStepCaptured: (callback: (data: { filepath: string; filename: string; stepNumber?: number }) => void) => {
    ipcRenderer.on('step-captured', (_event, data) => callback(data))
  },

  // Remove step captured listener
  removeStepCapturedListener: () => {
    ipcRenderer.removeAllListeners('step-captured')
  },

  // Listen for step skipped events
  onStepSkipped: (callback: () => void) => {
    ipcRenderer.on('step-skipped', () => callback())
  },

  // Remove step skipped listener
  // Remove step skipped listener
  removeStepSkippedListener: () => {
    ipcRenderer.removeAllListeners('step-skipped')
  },

  // Back step listener
  onStepBack: (callback: () => void) => {
    ipcRenderer.on('step-back', () => callback())
  },

  removeStepBackListener: () => {
    ipcRenderer.removeAllListeners('step-back')
  },

  // Complete capture
  completeCapture: () => ipcRenderer.invoke('complete-capture'),

  // Listen for capture completion (in main window)
  onCaptureCompleted: (callback: () => void) => {
    ipcRenderer.on('capture-completed', () => callback())
  },

  removeCaptureCompletedListener: () => {
    ipcRenderer.removeAllListeners('capture-completed')
  },
})

