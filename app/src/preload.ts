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

  // Capture control (now accepts optional step info + capture options)
  captureScreenshot: (stepInfo?: StepInfo, options?: any) =>
    ipcRenderer.invoke('capture-screenshot', stepInfo, options),
  retakeScreenshot: (stepInfo: any, options?: any) =>
    ipcRenderer.invoke('retake-screenshot', stepInfo, options),
  getScreenshotHistory: (projectPath: string) =>
    ipcRenderer.invoke('get-screenshot-history', projectPath),
  skipStep: () => ipcRenderer.invoke('skip-step'),
  backStep: () => ipcRenderer.invoke('back-step'),

  // Displays & capture sources
  getDisplays: () => ipcRenderer.invoke('get-displays'),
  getWindowSources: () => ipcRenderer.invoke('get-window-sources'),

  // Backend
  getBackendHealth: () => ipcRenderer.invoke('get-backend-health'),
  getBackendUrl: () => ipcRenderer.invoke('get-backend-url'),
  restartBackend: () => ipcRenderer.invoke('restart-backend'),

  // File helpers
  readFileBase64: (filePath: string) => ipcRenderer.invoke('read-file-base64', filePath),
  saveBase64Image: (data: { filePath: string; base64: string }) =>
    ipcRenderer.invoke('save-base64-image', data),
  openPath: (targetPath: string) => ipcRenderer.invoke('open-path', targetPath),
  showItemInFolder: (targetPath: string) => ipcRenderer.invoke('show-item-in-folder', targetPath),
  pickDirectory: () => ipcRenderer.invoke('pick-directory'),
  pickFile: (filters?: Array<{ name: string; extensions: string[] }>) =>
    ipcRenderer.invoke('pick-file', filters),
  getDefaultProjectLocation: () => ipcRenderer.invoke('get-default-project-location'),

  // Crash recovery / session tracking
  setActiveSession: (data: { projectPath: string; inProgress: boolean }) =>
    ipcRenderer.invoke('set-active-session', data),
  getRecoveryInfo: () => ipcRenderer.invoke('get-recovery-info'),
  clearActiveSession: () => ipcRenderer.invoke('clear-active-session'),

  // Project management
  initProject: (projectName: string) => ipcRenderer.invoke('init-project', projectName),
  saveProjectManifest: (data: { projectPath: string; manifest: object }) =>
    ipcRenderer.invoke('save-project-manifest', data),
  getRecentProjects: () => ipcRenderer.invoke('get-recent-projects'),
  loadProject: (projectPath: string) => ipcRenderer.invoke('load-project', projectPath),
  deleteProject: (projectPath: string) => ipcRenderer.invoke('delete-project', projectPath),

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

  // Trigger capture from hotkey
  onHotkeyCapture: (callback: () => void) => {
    ipcRenderer.on('hotkey-capture', () => callback())
  },
  removeHotkeyCaptureListener: () => {
    ipcRenderer.removeAllListeners('hotkey-capture')
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

  // Exit capture mode straight to the dashboard
  exitCaptureToHome: () => ipcRenderer.invoke('exit-capture-home'),

  // Listen for capture completion (in main window)
  onCaptureCompleted: (callback: () => void) => {
    ipcRenderer.on('capture-completed', () => callback())
  },

  removeCaptureCompletedListener: () => {
    ipcRenderer.removeAllListeners('capture-completed')
  },

  // Listen for exit-to-home (in main window)
  onCaptureExitHome: (callback: () => void) => {
    ipcRenderer.on('capture-exit-home', () => callback())
  },

  removeCaptureExitHomeListener: () => {
    ipcRenderer.removeAllListeners('capture-exit-home')
  },

  // Config
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config: any) => ipcRenderer.invoke('save-config', config),
})

