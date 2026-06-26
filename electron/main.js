'use strict';

const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

// ─────────────────────────────────────────────
// Environment detection
// ─────────────────────────────────────────────
const IS_DEV = process.env.ELECTRON_DEV === 'true' || !app.isPackaged;
const BACKEND_PORT = 3000;
const VITE_DEV_URL = `http://localhost:5173`;

// ─────────────────────────────────────────────
// State
// ─────────────────────────────────────────────
let mainWindow = null;
let splashWindow = null;
let backendProcess = null;

// ─────────────────────────────────────────────
// Paths (works both in dev and in .asar package)
// ─────────────────────────────────────────────
function getProjectRoot() {
  if (app.isPackaged) {
    // In packaged app, resources are in process.resourcesPath
    return process.resourcesPath;
  }
  // In dev, go up one level from electron/
  return path.join(__dirname, '..');
}

// ─────────────────────────────────────────────
// Spawn the NestJS backend
// ─────────────────────────────────────────────
function startBackend() {
  return new Promise((resolve, reject) => {
    if (IS_DEV) {
      // In dev mode the backend is already running via concurrently
      console.log('[Electron] Dev mode — assuming backend is already running');
      resolve();
      return;
    }

    const root = getProjectRoot();
    const backendMain = path.join(root, 'backend', 'dist', 'main.js');
    const nodeExe = process.execPath; // Electron's bundled Node

    console.log('[Electron] Starting backend:', backendMain);

    // Load .env so NestJS can read it; set cwd to backend folder so relative
    // paths inside NestJS resolve correctly
    backendProcess = spawn(nodeExe, [backendMain], {
      cwd: path.join(root, 'backend'),
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        NODE_ENV: 'production',
        PORT: String(BACKEND_PORT),
      },
      stdio: 'pipe',
    });

    backendProcess.stdout.on('data', (data) => {
      const msg = data.toString().trim();
      console.log('[Backend]', msg);
      // NestJS logs this line when it's ready
      if (msg.includes('Forge Mail backend is running')) {
        resolve();
      }
    });

    backendProcess.stderr.on('data', (data) => {
      console.error('[Backend ERR]', data.toString().trim());
    });

    backendProcess.on('error', (err) => {
      console.error('[Backend] Failed to start:', err);
      reject(err);
    });

    backendProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error('[Backend] Exited with code', code);
      }
    });

    // Fallback: poll HTTP until the server responds (max 30s)
    pollBackend(30000).then(resolve).catch(reject);
  });
}

// ─────────────────────────────────────────────
// Poll the backend until it responds or times out
// ─────────────────────────────────────────────
function pollBackend(timeoutMs) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(() => {
      const req = http.get(`http://localhost:${BACKEND_PORT}`, (res) => {
        clearInterval(interval);
        resolve();
      });
      req.on('error', () => {
        // not ready yet
        if (Date.now() - start > timeoutMs) {
          clearInterval(interval);
          reject(new Error('Backend did not start within timeout'));
        }
      });
      req.setTimeout(500, () => req.destroy());
    }, 500);
  });
}

// ─────────────────────────────────────────────
// Create the splash window
// ─────────────────────────────────────────────
function createSplash() {
  splashWindow = new BrowserWindow({
    width: 420,
    height: 280,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    center: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
}

// ─────────────────────────────────────────────
// Create the main application window
// ─────────────────────────────────────────────
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 760,
    minHeight: 560,
    show: false,
    backgroundColor: '#0a0a0f',
    title: 'Forge Mail',
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  // Open external links in the system browser, not in Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Remove the default menu bar
  mainWindow.setMenuBarVisibility(false);

  if (IS_DEV) {
    mainWindow.loadURL(VITE_DEV_URL);
    mainWindow.webContents.openDevTools();
  } else {
    const root = getProjectRoot();
    mainWindow.loadFile(path.join(root, 'frontend', 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.destroy();
    }
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─────────────────────────────────────────────
// App lifecycle
// ─────────────────────────────────────────────
app.whenReady().then(async () => {
  // Show splash immediately so the user sees something
  createSplash();

  try {
    await startBackend();
  } catch (err) {
    console.error('[Electron] Backend failed to start:', err);
    // Continue anyway — if in dev mode or backend was already running
  }

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('quit', () => {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill('SIGTERM');
  }
});
