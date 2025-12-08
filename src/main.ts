
import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage } from 'electron'
import { join } from 'path'

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.js
// │
// In dev: __dirname is out/main, in production: dist-electron
process.env.DIST = app.isPackaged
  ? join(__dirname, '../dist')
  : join(__dirname, '../../dist')
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : join(process.env.DIST, '../public')

let mainWindow: BrowserWindow | null = null
let hudWindow: BrowserWindow | null = null
let isQuiting = false
let tray: Tray | null = null

// Here, you can also use other preload
// In dev: out/preload/preload.js, in production: dist-electron/preload.js
const preload = app.isPackaged
  ? join(__dirname, 'preload.js')
  : join(__dirname, '../preload/preload.js')
// Get Vite dev server URL - electron-vite sets this, but fallback to default
const url = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1200,
    minHeight: 800,
    maxWidth: 1200,
    maxHeight: 800,
    resizable: false,
    frame: false,
    autoHideMenuBar: true,
    icon: join(process.env.VITE_PUBLIC, 'favicon.ico'),
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: 'hidden',
    backgroundColor: '#111827',
    ...(process.platform === 'darwin' ? {
      titleBarStyle: 'hiddenInset',
      vibrancy: 'under-window',
      visualEffectState: 'active',
    } : {}),
    ...(process.platform === 'win32' ? {
      titleBarStyle: 'hidden',
      titleBarOverlay: false,
    } : {}),
  })

  // In dev mode, always use Vite dev server
  // In production, loadFile will be used
  if (!app.isPackaged && url) {
    // Dev mode: use Vite dev server
    mainWindow.loadURL(url)
    mainWindow.webContents.openDevTools()
  } else {
    // Production: load from dist
    mainWindow.loadFile(join(process.env.DIST, 'index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function createHUDWindow() {
  hudWindow = new BrowserWindow({
    width: 420,
    height: 320,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
    },
    backgroundColor: '#00000000',
  })

  // In dev mode, always use Vite dev server
  // In production, loadFile will be used
  if (!app.isPackaged && url) {
    // Dev mode: use Vite dev server
    hudWindow.loadURL(`${url}#/hud`)
  } else {
    // Production: load from dist
    hudWindow.loadFile(join(process.env.DIST, 'index.html'), {
      hash: 'hud',
    })
  }

  hudWindow.on('closed', () => {
    hudWindow = null
  })

  // Initially hide the HUD window
  hudWindow.hide()
}

app.on('window-all-closed', () => {
  // Don't quit automatically - only quit when explicitly closed
  // This allows hiding the window without quitting
  if (process.platform !== 'darwin' && !isQuiting) {
    // Don't auto-quit - let user control via close button
  } else if (isQuiting) {
    app.quit()
  }
})

app.on('before-quit', () => {
  // Clean up on explicit quit
  mainWindow = null
  hudWindow = null
})

app.on('activate', () => {
  // On macOS, re-show window when dock icon is clicked
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
  } else if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow()
  }
})

function createTray() {
  // Create a simple tray icon
  const icon = nativeImage.createEmpty()
  icon.setTemplateImage(true)
  
  tray = new Tray(icon)
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show NullDraft',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuiting = true
        app.quit()
      },
    },
  ])
  
  tray.setToolTip('NullDraft')
  tray.setContextMenu(contextMenu)
  
  // Click to show/hide window
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide()
      } else {
        mainWindow.show()
        mainWindow.focus()
      }
    }
  })
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  createMainWindow()
  createHUDWindow()
  createTray()

  // IPC handlers for window communication
  ipcMain.handle('show-hud', () => {
    if (hudWindow) {
      hudWindow.show()
      return true
    }
    return false
  })

  ipcMain.handle('hide-hud', () => {
    if (hudWindow) {
      hudWindow.hide()
      return true
    }
    return false
  })

  ipcMain.handle('is-hud-visible', () => {
    return hudWindow?.isVisible() ?? false
  })

  ipcMain.handle('update-hud-data', (_event, data) => {
    if (hudWindow) {
      hudWindow.webContents.send('hud-data-update', data)
      return true
    }
    return false
  })

  ipcMain.handle('close-window', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      isQuiting = true
      mainWindow.close()
      // On close, quit the app
      app.quit()
      return true
    }
    return false
  })

  ipcMain.handle('hide-window', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.hide()
      // Don't quit on hide - just hide the window
      return true
    }
    return false
  })

  ipcMain.handle('capture-screenshot', () => {
    // TODO: Implement screenshot capture logic
    console.log('Screenshot capture requested')
    // This will be implemented with actual screenshot functionality
    return true
  })

  ipcMain.handle('skip-step', () => {
    // TODO: Implement skip step logic
    console.log('Step skip requested')
    // Notify main window to move to next step
    if (mainWindow) {
      mainWindow.webContents.send('step-skipped')
    }
    return true
  })
})

