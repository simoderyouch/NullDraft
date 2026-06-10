/// <reference types="vite/client" />

interface StepInfo {
  projectPath: string
  stepNumber: number
  stepTitle: string
}

interface CaptureResult {
  success: boolean
  filepath?: string
  filename?: string
  error?: string
}

interface InitProjectResult {
  success: boolean
  projectPath?: string
  error?: string
}

interface RecentProject {
  id: string
  name: string
  path: string
  lastModified: string
  stepCount: number
}

interface GetRecentProjectsResult {
  success: boolean
  projects: RecentProject[]
  error?: string
}

interface Window {
  electronAPI: {
    // HUD control
    showHUD: () => Promise<boolean>
    hideHUD: () => Promise<boolean>
    isHUDVisible: () => Promise<boolean>
    updateHUDData: (data: any) => Promise<boolean>
    getHUDData: () => Promise<any>

    // Window control
    closeWindow: () => Promise<boolean>
    hideWindow: () => Promise<boolean>
    showWindow: () => Promise<boolean>
    minimizeWindow: () => Promise<boolean>

    // Capture control
    captureScreenshot: (stepInfo?: StepInfo, options?: CaptureOptions) => Promise<CaptureResult>
    retakeScreenshot: (stepInfo: StepInfo & { currentImage?: string }, options?: CaptureOptions) => Promise<CaptureResult>
    getScreenshotHistory: (projectPath: string) => Promise<{ success: boolean; files: string[]; error?: string }>
    skipStep: () => Promise<boolean>
    backStep: () => Promise<boolean>

    // Displays & capture sources
    getDisplays: () => Promise<Array<{ id: number; index: number; label: string; bounds: any; isPrimary: boolean }>>
    getWindowSources: () => Promise<Array<{ id: string; name: string; thumbnail: string }>>

    // Backend
    getBackendHealth: () => Promise<any>
    getBackendUrl: () => Promise<string>
    restartBackend: () => Promise<any>

    // File helpers
    readFileBase64: (filePath: string) => Promise<{ success: boolean; data?: string; error?: string }>
    saveBase64Image: (data: { filePath: string; base64: string }) => Promise<{ success: boolean; filePath?: string; error?: string }>
    openPath: (targetPath: string) => Promise<{ success: boolean; error?: string }>
    showItemInFolder: (targetPath: string) => Promise<{ success: boolean }>
    pickDirectory: () => Promise<{ success: boolean; path?: string }>
    pickFile: (filters?: Array<{ name: string; extensions: string[] }>) => Promise<{ success: boolean; path?: string }>
    getDefaultProjectLocation: () => Promise<string>

    // Crash recovery / session tracking
    setActiveSession: (data: { projectPath: string; inProgress: boolean }) => Promise<boolean>
    getRecoveryInfo: () => Promise<{ recover: boolean; projectPath?: string; name?: string }>
    clearActiveSession: () => Promise<boolean>

    // Project management
    initProject: (projectName: string) => Promise<InitProjectResult>
    saveProjectManifest: (data: { projectPath: string; manifest: object }) => Promise<{ success: boolean; error?: string }>
    getRecentProjects: () => Promise<GetRecentProjectsResult>
    loadProject: (projectPath: string) => Promise<{ success: boolean; project?: any; error?: string }>
    deleteProject: (projectPath: string) => Promise<{ success: boolean; error?: string }>

    // Event listeners
    onHUDDataUpdate: (callback: (data: any) => void) => void
    removeHUDDataListener: () => void
    onCaptureSuccess: (callback: (data: { filepath: string; filename: string }) => void) => void
    removeCaptureSuccessListener: () => void
    onHotkeyCapture: (callback: () => void) => void
    removeHotkeyCaptureListener: () => void
    onStepCaptured: (callback: (data: { filepath: string; filename: string; stepNumber?: number }) => void) => void
    removeStepCapturedListener: () => void
    onStepSkipped: (callback: () => void) => void
    removeStepSkippedListener: () => void
    onStepBack: (callback: () => void) => void
    removeStepBackListener: () => void
    completeCapture: () => Promise<boolean>
    onCaptureCompleted: (callback: () => void) => void
    removeCaptureCompletedListener: () => void

    // Config
    getConfig: () => Promise<AppConfig>
    saveConfig: (config: AppConfig) => Promise<boolean>
  }
}

interface CaptureOptions {
  mode?: 'fullscreen' | 'window' | 'region' | 'display'
  displayId?: number
  sourceId?: string
  region?: { x: number; y: number; width: number; height: number }
  reuseLastRegion?: boolean
  format?: 'png' | 'jpg'
  quality?: number
}

interface AppConfig {
  apiKey: string
  captureHotkey: string
  skipHotkey: string
  backHotkey: string
  darkMode: boolean
  provider: string
  defaultProjectLocation: string
  exportFormat: string
  exportTemplate: string
  screenshotFormat: string
  screenshotQuality: number
  localOnly: boolean
  encryptProjects: boolean
  encryptionPassphrase: string
  lastRegion: { x: number; y: number; width: number; height: number } | null
  lastActiveProject: string
  captureInProgress: boolean
}

