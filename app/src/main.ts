console.log('Main process starting... code execution begun.')
import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, globalShortcut, shell, dialog, desktopCapturer, screen } from 'electron'

// Disable sandbox on Linux to fix AppImage SUID issues
// Disable sandbox on Linux to fix AppImage SUID issues (only in production)
if (process.platform === 'linux') {
  app.disableHardwareAcceleration()
  const isWayland =
    process.env.XDG_SESSION_TYPE === 'wayland' || Boolean(process.env.WAYLAND_DISPLAY)
  if (isWayland) {
    app.commandLine.appendSwitch('enable-features', 'WebRTCPipeWireCapturer')
  }
  if (app.isPackaged) {
    app.commandLine.appendSwitch('no-sandbox')
    app.commandLine.appendSwitch('disable-setuid-sandbox')
  }
}
import { join } from 'path'
import { mkdir, writeFile, readFile, readdir, stat, rm, rename } from 'fs/promises'
import { existsSync } from 'fs'
import { startBackend, stopBackend, getBackendHealth, getBackendUrl } from './backend-manager'

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

const DEFAULT_CONFIG: AppConfig = {
  apiKey: '',
  captureHotkey: 'CommandOrControl+Shift+S',
  skipHotkey: 'CommandOrControl+Shift+N',
  backHotkey: 'CommandOrControl+Shift+B',
  darkMode: false,
  provider: 'mistral',
  defaultProjectLocation: '',
  exportFormat: 'pdf',
  exportTemplate: 'default',
  screenshotFormat: 'png',
  screenshotQuality: 90,
  localOnly: false,
  encryptProjects: false,
  encryptionPassphrase: '',
  lastRegion: null,
  lastActiveProject: '',
  captureInProgress: false,
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

// ---- Project encryption (at rest) ----
import crypto from 'crypto'

const ENC_MARKER = '__nulldraft_encrypted__'

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return crypto.scryptSync(passphrase, salt, 32)
}

function encryptJson(obj: unknown, passphrase: string): string {
  const salt = crypto.randomBytes(16)
  const iv = crypto.randomBytes(12)
  const key = deriveKey(passphrase, salt)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const plaintext = Buffer.from(JSON.stringify(obj), 'utf-8')
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  return JSON.stringify({
    [ENC_MARKER]: true,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
  })
}

function decryptJson(raw: string, passphrase: string): any {
  const wrapper = JSON.parse(raw)
  if (!wrapper || !wrapper[ENC_MARKER]) {
    return wrapper // not encrypted
  }
  if (!passphrase) {
    throw new Error('Project is encrypted but no passphrase is configured')
  }
  const salt = Buffer.from(wrapper.salt, 'base64')
  const iv = Buffer.from(wrapper.iv, 'base64')
  const tag = Buffer.from(wrapper.tag, 'base64')
  const data = Buffer.from(wrapper.data, 'base64')
  const key = deriveKey(passphrase, salt)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
  return JSON.parse(decrypted.toString('utf-8'))
}

async function writeManifestFile(manifestPath: string, manifest: unknown) {
  if (currentConfig.encryptProjects && currentConfig.encryptionPassphrase) {
    await writeFile(manifestPath, encryptJson(manifest, currentConfig.encryptionPassphrase))
  } else {
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2))
  }
}

async function readManifestFile(manifestPath: string): Promise<any> {
  const raw = await readFile(manifestPath, 'utf-8')
  return decryptJson(raw, currentConfig.encryptionPassphrase)
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


// Get projects base directory (respects configurable location)
function getProjectsDir(): string {
  if (currentConfig.defaultProjectLocation && currentConfig.defaultProjectLocation.trim()) {
    return currentConfig.defaultProjectLocation
  }
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
    mainWindow.loadFile(join(process.env.DIST || '', 'index.html'))
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

interface CaptureOptions {
  mode?: 'fullscreen' | 'window' | 'region' | 'display'
  displayId?: number
  region?: { x: number; y: number; width: number; height: number }
  reuseLastRegion?: boolean
}

async function performCapture(
  stepInfo?: { projectPath: string; stepNumber: number; stepTitle: string },
  options?: CaptureOptions
) {
  try {
    // Temporarily hide HUD to avoid capturing it
    const wasHudVisible = hudWindow?.isVisible() ?? false
    if (wasHudVisible && hudWindow) {
      hudWindow.hide()
    }

    // Wait for HUD to hide
    await new Promise(resolve => setTimeout(resolve, 200))

    // Region mode: reuse last region or let the user draw one.
    let regionToUse = options?.region
    if (options?.mode === 'region' && !regionToUse) {
      if (options?.reuseLastRegion && currentConfig.lastRegion) {
        regionToUse = currentConfig.lastRegion
      } else {
        const selected = await selectRegion(options?.displayId)
        if (!selected) {
          if (wasHudVisible && hudWindow) hudWindow.show()
          return { success: false, error: 'Region selection cancelled' }
        }
        regionToUse = selected
        await saveConfig({ ...currentConfig, lastRegion: selected })
      }
    }

    const ext = currentConfig.screenshotFormat === 'jpg' ? 'jpg' : 'png'

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
      filename = `step-${paddedNumber}-${slug}.${ext}`
      filepath = join(stepInfo.projectPath, filename)
    } else {
      // Fallback to timestamp naming in projects dir
      const now = new Date()
      const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
      filename = `capture-${timestamp}.${ext}`
      const projectsDir = getProjectsDir()
      await mkdir(projectsDir, { recursive: true })
      filepath = join(projectsDir, filename)
    }

    // Handle screenshot capturing based on platform
    try {
      const { captureScreenshot } = await import('./screenshot-helper')
      await captureScreenshot(filepath, process.platform, {
        mode: options?.mode || 'fullscreen',
        displayId: options?.displayId,
        region: regionToUse,
        format: ext,
        quality: currentConfig.screenshotQuality,
      })
    } catch (err) {
      console.error("Failed to capture screenshot:", err)
      // Throw so the IPC handler knows it failed
      throw err
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
        const manifest = await readManifestFile(manifestPath)

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

        await writeManifestFile(manifestPath, manifest)
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


// Region selection overlay: opens a fullscreen transparent window over a display
// and lets the user drag a rectangle. Resolves with region in DIP coords or null.
function selectRegion(displayId?: number): Promise<{ x: number; y: number; width: number; height: number } | null> {
  return new Promise((resolve) => {
    let display = screen.getPrimaryDisplay()
    if (displayId != null) {
      const found = screen.getAllDisplays().find((d) => d.id === displayId)
      if (found) display = found
    }
    const { x, y, width, height } = display.bounds

    const overlay = new BrowserWindow({
      x, y, width, height,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      hasShadow: false,
      enableLargerThanScreen: true,
      webPreferences: { nodeIntegration: true, contextIsolation: false },
    })
    overlay.setAlwaysOnTop(true, 'screen-saver')

    const channel = `region-selected-${Date.now()}`
    const html = `data:text/html,${encodeURIComponent(`
      <html><head><style>
        html,body{margin:0;height:100%;cursor:crosshair;background:rgba(0,0,0,0.25);overflow:hidden;user-select:none}
        #sel{position:fixed;border:2px solid #3b82f6;background:rgba(59,130,246,0.2);display:none}
        #hint{position:fixed;top:12px;left:50%;transform:translateX(-50%);color:#fff;font-family:sans-serif;font-size:14px;background:rgba(0,0,0,0.6);padding:6px 12px;border-radius:8px}
      </style></head><body>
        <div id="hint">Drag to select a region — Esc to cancel</div>
        <div id="sel"></div>
        <script>
          const { ipcRenderer } = require('electron')
          let sx=0, sy=0, drawing=false
          const sel = document.getElementById('sel')
          document.addEventListener('mousedown', e=>{drawing=true; sx=e.clientX; sy=e.clientY; sel.style.display='block'})
          document.addEventListener('mousemove', e=>{ if(!drawing) return; const x=Math.min(sx,e.clientX),y=Math.min(sy,e.clientY),w=Math.abs(e.clientX-sx),h=Math.abs(e.clientY-sy); sel.style.left=x+'px';sel.style.top=y+'px';sel.style.width=w+'px';sel.style.height=h+'px' })
          document.addEventListener('mouseup', e=>{ if(!drawing) return; drawing=false; const x=Math.min(sx,e.clientX),y=Math.min(sy,e.clientY),w=Math.abs(e.clientX-sx),h=Math.abs(e.clientY-sy); ipcRenderer.send('${channel}', w>4&&h>4?{x,y,width:w,height:h}:null) })
          document.addEventListener('keydown', e=>{ if(e.key==='Escape') ipcRenderer.send('${channel}', null) })
        </script>
      </body></html>`)}`
    overlay.loadURL(html)

    const finish = (region: any) => {
      ipcMain.removeAllListeners(channel)
      if (!overlay.isDestroyed()) overlay.close()
      resolve(region)
    }
    ipcMain.once(channel, (_e, region) => finish(region))
    overlay.on('closed', () => resolve(null))
  })
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

  // Start the Python backend (non-blocking; reuses an existing one in dev)
  startBackend({
    apiKey: currentConfig.apiKey || process.env.MISTRAL_API_KEY,
    provider: currentConfig.provider,
  }).then((res) => {
    console.log('[backend] start result:', res)
  }).catch((e) => console.error('[backend] start error:', e))

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

  ipcMain.handle('capture-screenshot', async (_event, stepInfo?: { projectPath: string; stepNumber: number; stepTitle: string }, options?: CaptureOptions) => {
    return await performCapture(stepInfo, options)
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

  // Exit capture mode and return to the dashboard.
  ipcMain.handle('exit-capture-home', () => {
    console.log('Exit capture to home requested')
    if (hudWindow) {
      hudWindow.hide()
    }
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
      mainWindow.webContents.send('capture-exit-home')
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
      await writeManifestFile(manifestPath, data.manifest)
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
            const manifest = await readManifestFile(manifestPath)
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
      const manifest = await readManifestFile(manifestPath)

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

  // ---- Backend status ----
  ipcMain.handle('get-backend-health', async () => {
    return await getBackendHealth()
  })

  ipcMain.handle('get-backend-url', () => {
    return getBackendUrl()
  })

  ipcMain.handle('restart-backend', async () => {
    stopBackend()
    await new Promise((r) => setTimeout(r, 500))
    return await startBackend({ apiKey: currentConfig.apiKey, provider: currentConfig.provider })
  })

  // ---- Displays ----
  ipcMain.handle('get-displays', () => {
    return screen.getAllDisplays().map((d, idx) => ({
      id: d.id,
      index: idx,
      label: d.label || `Display ${idx + 1}`,
      bounds: d.bounds,
      isPrimary: d.id === screen.getPrimaryDisplay().id,
    }))
  })

  // ---- Capture window/region sources (for the renderer to pick) ----
  ipcMain.handle('get-window-sources', async () => {
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 320, height: 200 },
    })
    return sources.map((s) => ({
      id: s.id,
      name: s.name,
      thumbnail: s.thumbnail.toDataURL(),
    }))
  })

  // ---- File helpers ----
  ipcMain.handle('read-file-base64', async (_event, filePath: string) => {
    try {
      const buf = await readFile(filePath)
      return { success: true, data: buf.toString('base64') }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('save-base64-image', async (_event, data: { filePath: string; base64: string }) => {
    try {
      const cleaned = data.base64.replace(/^data:image\/\w+;base64,/, '')
      await writeFile(data.filePath, Buffer.from(cleaned, 'base64'))
      return { success: true, filePath: data.filePath }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // ---- Open / reveal in file manager ----
  ipcMain.handle('open-path', async (_event, targetPath: string) => {
    const err = await shell.openPath(targetPath)
    return { success: !err, error: err || undefined }
  })

  ipcMain.handle('show-item-in-folder', (_event, targetPath: string) => {
    shell.showItemInFolder(targetPath)
    return { success: true }
  })

  // ---- Pick a directory (for default project location) ----
  ipcMain.handle('pick-directory', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false }
    }
    return { success: true, path: result.filePaths[0] }
  })

  // ---- Retake screenshot (archives the previous one to a history folder) ----
  ipcMain.handle('retake-screenshot', async (_event, stepInfo: { projectPath: string; stepNumber: number; stepTitle: string; currentImage?: string }, options?: CaptureOptions) => {
    try {
      if (stepInfo.currentImage) {
        const current = join(stepInfo.projectPath, stepInfo.currentImage)
        if (existsSync(current)) {
          const historyDir = join(stepInfo.projectPath, '.history')
          await mkdir(historyDir, { recursive: true })
          const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
          const archived = join(historyDir, `${ts}-${stepInfo.currentImage}`)
          try {
            await rename(current, archived)
          } catch {
            // best effort
          }
        }
      }
    } catch (e) {
      console.error('Failed to archive previous screenshot:', e)
    }
    return await performCapture(stepInfo, options)
  })

  // ---- Get history for a step ----
  ipcMain.handle('get-screenshot-history', async (_event, projectPath: string) => {
    try {
      const historyDir = join(projectPath, '.history')
      if (!existsSync(historyDir)) return { success: true, files: [] }
      const files = await readdir(historyDir)
      return { success: true, files }
    } catch (error) {
      return { success: false, error: String(error), files: [] }
    }
  })

  // ---- Default project location helper ----
  ipcMain.handle('get-default-project-location', () => {
    return getProjectsDir()
  })

  // ---- Pick a file (e.g. logo) ----
  ipcMain.handle('pick-file', async (_event, filters?: Array<{ name: string; extensions: string[] }>) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: filters || [{ name: 'All Files', extensions: ['*'] }],
    })
    if (result.canceled || result.filePaths.length === 0) return { success: false }
    return { success: true, path: result.filePaths[0] }
  })

  // ---- Crash recovery / session tracking ----
  ipcMain.handle('set-active-session', async (_event, data: { projectPath: string; inProgress: boolean }) => {
    await saveConfig({
      ...currentConfig,
      lastActiveProject: data.projectPath || '',
      captureInProgress: data.inProgress,
    })
    return true
  })

  ipcMain.handle('get-recovery-info', async () => {
    if (currentConfig.captureInProgress && currentConfig.lastActiveProject) {
      // Confirm the project still exists
      const manifestPath = join(currentConfig.lastActiveProject, 'project.json')
      if (existsSync(manifestPath)) {
        try {
          const manifest = await readManifestFile(manifestPath)
          return {
            recover: true,
            projectPath: currentConfig.lastActiveProject,
            name: manifest.name || manifest.projectName || 'Untitled',
          }
        } catch {
          return { recover: false }
        }
      }
    }
    return { recover: false }
  })

  ipcMain.handle('clear-active-session', async () => {
    await saveConfig({ ...currentConfig, captureInProgress: false })
    return true
  })
})

