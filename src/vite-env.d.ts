/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    showHUD: () => Promise<boolean>
    hideHUD: () => Promise<boolean>
    isHUDVisible: () => Promise<boolean>
    updateHUDData: (data: any) => Promise<boolean>
    closeWindow: () => Promise<boolean>
    hideWindow: () => Promise<boolean>
    captureScreenshot: () => Promise<boolean>
    skipStep: () => Promise<boolean>
    onHUDDataUpdate: (callback: (data: any) => void) => void
    removeHUDDataListener: () => void
  }
}

