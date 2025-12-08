import { app, BrowserWindow, Menu, ipcMain, nativeImage, Tray } from "electron";
import { join } from "path";
import __cjs_url__ from "node:url";
import __cjs_path__ from "node:path";
import __cjs_mod__ from "node:module";
const __filename = __cjs_url__.fileURLToPath(import.meta.url);
const __dirname = __cjs_path__.dirname(__filename);
const require2 = __cjs_mod__.createRequire(import.meta.url);
process.env.DIST = app.isPackaged ? join(__dirname, "../dist") : join(__dirname, "../../dist");
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : join(process.env.DIST, "../public");
let mainWindow = null;
let hudWindow = null;
let isQuiting = false;
let tray = null;
const preload = app.isPackaged ? join(__dirname, "preload.js") : join(__dirname, "../preload/preload.js");
const url = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
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
    icon: join(process.env.VITE_PUBLIC, "favicon.ico"),
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true
    },
    titleBarStyle: "hidden",
    backgroundColor: "#111827",
    ...process.platform === "darwin" ? {
      titleBarStyle: "hiddenInset",
      vibrancy: "under-window",
      visualEffectState: "active"
    } : {},
    ...process.platform === "win32" ? {
      titleBarStyle: "hidden",
      titleBarOverlay: false
    } : {}
  });
  if (!app.isPackaged && url) {
    mainWindow.loadURL(url);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(process.env.DIST, "index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
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
      contextIsolation: true
    },
    backgroundColor: "#00000000"
  });
  if (!app.isPackaged && url) {
    hudWindow.loadURL(`${url}#/hud`);
  } else {
    hudWindow.loadFile(join(process.env.DIST, "index.html"), {
      hash: "hud"
    });
  }
  hudWindow.on("closed", () => {
    hudWindow = null;
  });
  hudWindow.hide();
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && !isQuiting) ;
  else if (isQuiting) {
    app.quit();
  }
});
app.on("before-quit", () => {
  mainWindow = null;
  hudWindow = null;
});
app.on("activate", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
  } else if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});
function createTray() {
  const icon = nativeImage.createEmpty();
  icon.setTemplateImage(true);
  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show NullDraft",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuiting = true;
        app.quit();
      }
    }
  ]);
  tray.setToolTip("NullDraft");
  tray.setContextMenu(contextMenu);
  tray.on("click", () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createMainWindow();
  createHUDWindow();
  createTray();
  ipcMain.handle("show-hud", () => {
    if (hudWindow) {
      hudWindow.show();
      return true;
    }
    return false;
  });
  ipcMain.handle("hide-hud", () => {
    if (hudWindow) {
      hudWindow.hide();
      return true;
    }
    return false;
  });
  ipcMain.handle("is-hud-visible", () => {
    return hudWindow?.isVisible() ?? false;
  });
  ipcMain.handle("update-hud-data", (_event, data) => {
    if (hudWindow) {
      hudWindow.webContents.send("hud-data-update", data);
      return true;
    }
    return false;
  });
  ipcMain.handle("close-window", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      isQuiting = true;
      mainWindow.close();
      app.quit();
      return true;
    }
    return false;
  });
  ipcMain.handle("hide-window", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.hide();
      return true;
    }
    return false;
  });
  ipcMain.handle("capture-screenshot", () => {
    console.log("Screenshot capture requested");
    return true;
  });
  ipcMain.handle("skip-step", () => {
    console.log("Step skip requested");
    if (mainWindow) {
      mainWindow.webContents.send("step-skipped");
    }
    return true;
  });
});
