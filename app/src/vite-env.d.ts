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
    captureScreenshot: (stepInfo?: StepInfo) => Promise<CaptureResult>
    skipStep: () => Promise<boolean>
    backStep: () => Promise<boolean>

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

interface AppConfig {
  apiKey: string
  captureHotkey: string
  skipHotkey: string
  backHotkey: string
  darkMode: boolean
}

