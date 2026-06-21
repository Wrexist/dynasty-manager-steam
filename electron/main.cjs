// Electron main process — Dynasty Manager (Steam desktop build).
//
// Phase 1 of STEAM_PORT.md. This file is intentionally written as CommonJS
// (.cjs) so it works regardless of the package.json "type":"module" setting and
// needs no separate main-process compile step.
//
// Design notes:
//  - Production renderer is served over a custom `app://` protocol (not file://)
//    so absolute asset paths like "/logo.webp" resolve correctly. file:// would
//    map "/" to the filesystem root and break those references.
//  - Renderer stays sandboxed: contextIsolation on, nodeIntegration off. Native
//    Steam access (Phase 5) will live HERE in the main process and be exposed to
//    the renderer only through electron/preload.cjs.
//  - Steam overlay launch flags (in-process-gpu, disable-direct-composition)
//    are deliberately NOT added yet — they land in Phase 4/5 alongside the
//    steamworks.js integration and overlay testing.

const { app, BrowserWindow, protocol, net, shell, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const DIST_DIR = path.join(__dirname, '..', 'dist');
const DEV_URL = process.env.ELECTRON_START_URL; // set by scripts/electron-dev.mjs
const isDev = !app.isPackaged && !!DEV_URL;

// --- Window state persistence ------------------------------------------------
const stateFile = () => path.join(app.getPath('userData'), 'window-state.json');

function loadWindowState() {
  try {
    const raw = fs.readFileSync(stateFile(), 'utf-8');
    const s = JSON.parse(raw);
    if (s && Number.isFinite(s.width) && Number.isFinite(s.height)) return s;
  } catch {
    /* first launch or corrupt — fall through to defaults */
  }
  return { width: 1280, height: 800 };
}

function saveWindowState(win) {
  try {
    if (!win || win.isDestroyed()) return;
    const bounds = win.getBounds();
    fs.writeFileSync(
      stateFile(),
      JSON.stringify({ ...bounds, maximized: win.isMaximized() }),
    );
  } catch {
    /* non-fatal: a lost window position is not worth crashing over */
  }
}

// --- Custom app:// protocol (privileged, serves dist/) -----------------------
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);

function registerAppProtocol() {
  protocol.handle('app', (request) => {
    const url = new URL(request.url);
    // HashRouter means every route is index.html; only real files have a path.
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/' || pathname === '') pathname = '/index.html';

    const resolved = path.normalize(path.join(DIST_DIR, pathname));
    // Path-traversal guard: never serve outside dist/.
    if (!resolved.startsWith(DIST_DIR)) {
      return new Response('Forbidden', { status: 403 });
    }
    const target = fs.existsSync(resolved) ? resolved : path.join(DIST_DIR, 'index.html');
    return net.fetch(pathToFileURL(target).toString());
  });
}

// --- Window ------------------------------------------------------------------
let mainWindow = null;

function createWindow() {
  const state = loadWindowState();

  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 1024,
    minHeight: 768,
    show: false,
    backgroundColor: '#0f1524', // matches app background; avoids white flash
    title: 'Dynasty Manager',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (state.maximized) mainWindow.maximize();

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Persist size/position on resize/move/close (debounced via close is enough
  // for Phase 1; per-event saving can come later if needed).
  mainWindow.on('close', () => saveWindowState(mainWindow));
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open target=_blank / external links in the OS browser, never in-app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.loadURL(DEV_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadURL('app://local/index.html');
  }
}

// --- Single-instance lock ----------------------------------------------------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    registerAppProtocol();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

// --- IPC: external links from the renderer (via preload bridge) --------------
ipcMain.handle('app:openExternal', (_event, url) => {
  if (typeof url === 'string' && /^https?:\/\//.test(url)) {
    return shell.openExternal(url);
  }
  return Promise.resolve();
});
