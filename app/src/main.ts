console.log('Main process starting... code execution begun.')
import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, globalShortcut } from 'electron'

// Disable sandbox on Linux to fix AppImage SUID issues
// Disable sandbox on Linux to fix AppImage SUID issues (only in production)
if (process.platform === 'linux') {
  app.disableHardwareAcceleration()
  if (app.isPackaged) {
    app.commandLine.appendSwitch('no-sandbox')
    app.commandLine.appendSwitch('disable-setuid-sandbox')
  }
}
import { join } from 'path'
import { mkdir, writeFile, readdir, readFile, stat, rm } from 'fs/promises'
import { existsSync } from 'fs'

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
  ? join(__dirname, '../renderer')
  : join(__dirname, '../../renderer')

if (!process.env.DIST) {
  throw new Error('DIST environment variable is not defined')
}

process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : join(process.env.DIST, '../public')

let mainWindow: BrowserWindow | null = null
let hudWindow: BrowserWindow | null = null
let isQuiting = false
let tray: Tray | null = null
let hudData: any = null // Store HUD data for retrieval

// Config Interface
interface AppConfig {
  apiKey: string
  captureHotkey: string
  skipHotkey: string
  backHotkey: string
  darkMode: boolean
}

const DEFAULT_CONFIG: AppConfig = {
  apiKey: '',
  captureHotkey: 'CommandOrControl+Shift+S',
  skipHotkey: 'CommandOrControl+Shift+N',
  backHotkey: 'CommandOrControl+Shift+B',
  darkMode: false,
}

let currentConfig: AppConfig = { ...DEFAULT_CONFIG }

// Config Management
function getConfigPath(): string {
  return join(app.getPath('userData'), 'config.json')
}

async function loadConfig() {
  try {
    const configPath = getConfigPath()
    if (existsSync(configPath)) {
      const data = await readFile(configPath, 'utf-8')
      currentConfig = { ...DEFAULT_CONFIG, ...JSON.parse(data) }
    } else {
      await saveConfig(DEFAULT_CONFIG)
    }
  } catch (error) {
    console.error('Failed to load config:', error)
  }
}

async function saveConfig(config: AppConfig) {
  try {
    const configPath = getConfigPath()
    await writeFile(configPath, JSON.stringify(config, null, 2))
    currentConfig = config
    registerGlobalShortcuts() // Re-register shortcuts on save
  } catch (error) {
    console.error('Failed to save config:', error)
  }
}

// Global Shortcut Management
function registerGlobalShortcuts() {
  globalShortcut.unregisterAll()

  if (currentConfig.captureHotkey) {
    try {
      globalShortcut.register(currentConfig.captureHotkey, () => {
        console.log('Capture hotkey triggered')
        // Notify HUD to perform capture with its local state
        if (hudWindow && !hudWindow.isDestroyed()) {
          hudWindow.webContents.send('hotkey-capture')
        }
      })
    } catch (e) { console.error('Failed to register capture hotkey', e) }
  }

  if (currentConfig.skipHotkey) {
    try {
      globalShortcut.register(currentConfig.skipHotkey, () => {
        console.log('Skip hotkey triggered')
        // Trigger skip in main (which notifies HUD)
        if (hudWindow && !hudWindow.isDestroyed()) {
          handleSkipStep()
        }
      })
    } catch (e) { console.error('Failed to register skip hotkey', e) }
  }

  if (currentConfig.backHotkey) {
    try {
      globalShortcut.register(currentConfig.backHotkey, () => {
        console.log('Back hotkey triggered')
        // Trigger back in main (which notifies HUD)
        if (hudWindow && !hudWindow.isDestroyed()) {
          handleBackStep()
        }
      })
    } catch (e) { console.error('Failed to register back hotkey', e) }
  }
}


// Get projects base directory
function getProjectsDir(): string {
  return join(app.getPath('userData'), 'projects')
}

// Create project directory and return path
async function createProjectDir(projectName: string): Promise<string> {
  const projectsDir = getProjectsDir()
  // Sanitize project name for filesystem
  const safeName = projectName.replace(/[^a-zA-Z0-9-_ ]/g, '').trim() || 'Untitled'
  const projectPath = join(projectsDir, safeName)
  await mkdir(projectPath, { recursive: true })
  return projectPath
}

// In dev: out/preload/preload.js, in production: dist-electron/preload.js
const preload = join(__dirname, '../preload/preload.js')
// Get Vite dev server URL - electron-vite sets this, but fallback to default
const url = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'

function createMainWindow() {
  const iconPath = join(__dirname, '../../build/icons/512x512.png')
  const appIcon = nativeImage.createFromPath(iconPath)
  if (appIcon.isEmpty()) {
    console.error('Failed to load icon from:', iconPath)
  } else {
    console.log('Icon loaded successfully from:', iconPath)
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    resizable: true,
    frame: false,
    autoHideMenuBar: true,
    icon: appIcon,
    ...(process.platform === 'linux' ? {
      icon: appIcon,
    } : {}),
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Allow loading local file:// images
    },
    titleBarStyle: 'hidden',
    transparent: true,
    backgroundColor: '#00000000',
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

  // Set icon explicitly
  mainWindow.setIcon(appIcon)

  if (!app.isPackaged && url) {
    mainWindow.loadURL(url)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(process.env.DIST, 'index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function createHUDWindow() {
  hudWindow = new BrowserWindow({
    width: 600,
    height: 500,
    center: true,
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
      webSecurity: false,
    },
    backgroundColor: '#00000000',
  })


  if (!app.isPackaged && url) {
    hudWindow.loadURL(`${url}#/hud`)
  } else {
    // Process.env.DIST is guaranteed to be defined here due to early check
    console.log('Loading HUD from file:', join(process.env.DIST!, 'index.html'))
    hudWindow.loadFile(join(process.env.DIST!, 'index.html'), {
      hash: '/hud',
    }).then(() => {
      console.log('HUD loaded successfully')
    }).catch(err => {
      console.error('Failed to load HUD:', err)
    })
  }

  hudWindow.on('closed', () => {
    hudWindow = null
  })

  hudWindow.on('ready-to-show', () => {
    console.log('HUD ready to show')
  })

  // Open DevTools for HUD to help debug
  hudWindow.webContents.openDevTools({ mode: 'detach' })

  hudWindow.hide()
}

app.on('window-all-closed', () => {

  if (process.platform !== 'darwin' && !isQuiting) {
  } else if (isQuiting) {
    app.quit()
  }
})

app.on('before-quit', () => {
  mainWindow = null
  hudWindow = null
})

app.on('activate', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
  } else if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow()
  }
})

function createTray() {
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

// Core Action Logic using standalone functions to be reused by IPC and Shortcuts

async function performCapture(stepInfo?: { projectPath: string; stepNumber: number; stepTitle: string }) {
  try {
    // Temporarily hide HUD to avoid capturing it
    const wasHudVisible = hudWindow?.isVisible() ?? false
    if (wasHudVisible && hudWindow) {
      hudWindow.hide()
    }

    // Wait for HUD to hide
    await new Promise(resolve => setTimeout(resolve, 200))

    // Generate filename based on step info or timestamp
    let filename: string
    let filepath: string

    if (stepInfo) {
      // Use step-based naming
      const paddedNumber = String(stepInfo.stepNumber).padStart(2, '0')
      const safeTitle = stepInfo.stepTitle || 'untitled'
      const slug = safeTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 30)
      filename = `step-${paddedNumber}-${slug}.png`
      filepath = join(stepInfo.projectPath, filename)
    } else {
      // Fallback to timestamp naming in projects dir
      const now = new Date()
      const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
      filename = `capture-${timestamp}.png`
      const projectsDir = getProjectsDir()
      await mkdir(projectsDir, { recursive: true })
      filepath = join(projectsDir, filename)
    }

    // Use gnome-screenshot for Wayland support
    const { exec } = await import('child_process')
    const { promisify } = await import('util')
    const execAsync = promisify(exec)

    // TODO: Support other platforms
    if (process.platform === 'linux') {
      await execAsync(`gnome-screenshot -f "${filepath}"`)
    } else {
      // Fallback or specific impl for Mac/Win if needed (screenshot-desktop handles some)
      // For now reusing Linux logic or fallback to screenshot-desktop
      const screenshot = await import('screenshot-desktop')
      await screenshot.default({ filename: filepath })
    }


    console.log('Screenshot saved to:', filepath)

    // Flash effect for visual feedback
    const { screen } = await import('electron')
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width, height } = primaryDisplay.size

    const flashWindow = new BrowserWindow({
      width,
      height,
      x: 0,
      y: 0,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      focusable: false,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    })

    flashWindow.loadURL(`data:text/html,
        <html>
          <head>
            <style>
              body {
                margin: 0;
                padding: 0;
                background: white;
                opacity: 0.6;
                animation: flash 100ms ease-out forwards;
              }
              @keyframes flash {
                0% { opacity: 0.6; }
                100% { opacity: 0; }
              }
            </style>
          </head>
          <body></body>
        </html>
      `)

    flashWindow.once('ready-to-show', () => {
      flashWindow.show()
      setTimeout(() => {
        flashWindow.close()
      }, 150)
    })

    // Restore HUD visibility
    if (wasHudVisible && hudWindow) {
      hudWindow.show()
    }

    // Update project.json manifest with captured image path
    if (stepInfo) {
      try {
        const manifestPath = join(stepInfo.projectPath, 'project.json')
        const { readFile } = await import('fs/promises')
        const manifestContent = await readFile(manifestPath, 'utf-8')
        const manifest = JSON.parse(manifestContent)

        // Update the step with imagePath and captured status
        if (manifest.steps) {
          manifest.steps = manifest.steps.map((step: any) => {
            if (step.number === stepInfo.stepNumber) {
              return { ...step, imagePath: filename, captured: true }
            }
            return step
          })
        }
        manifest.updatedAt = new Date().toISOString()

        await writeFile(manifestPath, JSON.stringify(manifest, null, 2))
        console.log('Manifest updated for step:', stepInfo.stepNumber)
      } catch (manifestError) {
        console.error('Failed to update manifest:', manifestError)
      }
    }

    // Notify HUD of success
    if (hudWindow) {
      hudWindow.webContents.send('capture-success', { filepath, filename })
    }

    // Notify main window to advance to next step
    if (mainWindow) {
      mainWindow.webContents.send('step-captured', { filepath, filename, stepNumber: stepInfo?.stepNumber })
    }

    return { success: true, filepath, filename }
  } catch (error) {
    console.error('Screenshot capture failed:', error)
    // Restore HUD visibility on error
    if (hudWindow?.isVisible() === false) {
      hudWindow.show()
    }
    return { success: false, error: String(error) }
  }
}

function handleSkipStep() {
  console.log('Step skip requested')
  // Notify main window to move to next step
  if (mainWindow) {
    mainWindow.webContents.send('step-skipped')
  }
  // Notify HUD to update
  if (hudWindow) {
    hudWindow.webContents.send('step-skipped')
  }
  return true
}

function handleBackStep() {
  console.log('Step back requested')
  // Notify main window to move to next step
  if (mainWindow) {
    mainWindow.webContents.send('step-back')
  }
  // Notify HUD to update
  if (hudWindow) {
    hudWindow.webContents.send('step-back')
  }
  return true
}


app.whenReady().then(async () => {
  await loadConfig() // Load config before creating windows

  // Set desktop name for Linux icon association
  if (process.platform === 'linux') {
    // @ts-ignore
    app.setDesktopName('NullDraft.desktop')
  }

  Menu.setApplicationMenu(null)
  createMainWindow()
  createHUDWindow()
  createTray()
  registerGlobalShortcuts()

  // Config IPC Handlers
  ipcMain.handle('get-config', () => {
    return currentConfig
  })

  ipcMain.handle('save-config', async (_event, config: AppConfig) => {
    await saveConfig(config)
    return true
  })


  // IPC handlers for window communication
  ipcMain.handle('show-hud', () => {
    console.log('Received show-hud request')
    if (hudWindow) {
      console.log('Showing HUD window')
      hudWindow.show()
      // Fix for always on top behavior on Linux
      hudWindow.setAlwaysOnTop(true, 'screen-saver')
      return true
    }
    console.log('HUD window not found!')
    return false
  })

  ipcMain.handle('hide-hud', () => {
    console.log('Received hide-hud request')
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
    hudData = data // Store the HUD data for later retrieval
    if (hudWindow) {
      hudWindow.webContents.send('hud-data-update', data)
      return true
    }
    return false
  })

  ipcMain.handle('get-hud-data', () => {
    return hudData
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
      return true
    }
    return false
  })

  ipcMain.handle('show-window', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
      mainWindow.focus()
      return true
    }
    return false
  })

  ipcMain.handle('minimize-window', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.minimize()
      return true
    }
    return false
  })

  ipcMain.handle('capture-screenshot', async (_event, stepInfo?: { projectPath: string; stepNumber: number; stepTitle: string }) => {
    return await performCapture(stepInfo)
  })

  ipcMain.handle('skip-step', () => {
    return handleSkipStep()
  })


  ipcMain.handle('back-step', () => {
    return handleBackStep()
  })

  ipcMain.handle('complete-capture', () => {
    console.log('Capture completion requested')
    // Hide HUD
    if (hudWindow) {
      hudWindow.hide()
    }
    // Show main window and notify it
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
      mainWindow.webContents.send('capture-completed')
    }
    return true
  })

  // Initialize a new project folder
  ipcMain.handle('init-project', async (_event, projectName: string) => {
    try {
      const projectPath = await createProjectDir(projectName)
      console.log('Project initialized at:', projectPath)
      return { success: true, projectPath }
    } catch (error) {
      console.error('Failed to init project:', error)
      return { success: false, error: String(error) }
    }
  })

  // Save project manifest (project.json)
  ipcMain.handle('save-project-manifest', async (_event, data: { projectPath: string; manifest: object }) => {
    try {
      const manifestPath = join(data.projectPath, 'project.json')
      await writeFile(manifestPath, JSON.stringify(data.manifest, null, 2))
      console.log('Project manifest saved to:', manifestPath)
      return { success: true }
    } catch (error) {
      console.error('Failed to save manifest:', error)
      return { success: false, error: String(error) }
    }
  })

  // Get recent projects
  ipcMain.handle('get-recent-projects', async () => {
    try {
      const projectsDir = getProjectsDir()

      // Ensure directory exists
      await mkdir(projectsDir, { recursive: true })

      const entries = await readdir(projectsDir, { withFileTypes: true })
      const projects: Array<{
        id: string
        name: string
        path: string
        lastModified: string
        stepCount: number
      }> = []

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const projectPath = join(projectsDir, entry.name)
          const manifestPath = join(projectPath, 'project.json')

          try {
            const manifestContent = await readFile(manifestPath, 'utf-8')
            const manifest = JSON.parse(manifestContent)
            const projectStat = await stat(manifestPath)

            projects.push({
              id: entry.name,
              name: manifest.projectName || entry.name,
              path: projectPath,
              lastModified: projectStat.mtime.toISOString(),
              stepCount: manifest.steps?.length || 0
            })
          } catch {
            // Skip directories without valid manifest
          }
        }
      }

      // Sort by last modified date (newest first)
      projects.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())

      return { success: true, projects }
    } catch (error) {
      console.error('Failed to get recent projects:', error)
      return { success: false, error: String(error), projects: [] }
    }
  })

  // Load project from path
  ipcMain.handle('load-project', async (_event, projectPath: string) => {
    try {
      const manifestPath = join(projectPath, 'project.json')
      const manifestContent = await readFile(manifestPath, 'utf-8')
      const manifest = JSON.parse(manifestContent)

      return {
        success: true,
        project: {
          ...manifest,
          path: projectPath
        }
      }
    } catch (error) {
      console.error('Failed to load project:', error)
      return { success: false, error: String(error) }
    }
  })

  // Delete project
  ipcMain.handle('delete-project', async (_event, projectPath: string) => {
    try {
      console.log('Deleting project at:', projectPath)
      // verify it's inside projects dir for safety
      const projectsDir = getProjectsDir()
      if (!projectPath.startsWith(projectsDir)) {
        throw new Error('Invalid project path')
      }

      await rm(projectPath, { recursive: true, force: true })
      return { success: true }
    } catch (error) {
      console.error('Failed to delete project:', error)
      return { success: false, error: String(error) }
    }
  })
})

