// Electron preload — the ONLY bridge between the sandboxed renderer and the
// main process. Keep the surface minimal and Steam-agnostic.
//
// The renderer detects the desktop build via `window.electronAPI?.isElectron`.
// The `steam` namespace forwards to the main-process integration in steam.cjs.
// Every method is safe to call unconditionally: when Steam is unavailable the
// main process returns falsy values, so renderer/game code only needs to branch
// on `isAvailable()`.

const { contextBridge, ipcRenderer } = require('electron');

// Steam availability is fixed for the process lifetime (Steam is either running
// when we launch or it isn't), so resolve it once synchronously at preload time
// and expose a cheap sync getter — callers use it at UI decision points.
let steamAvailable = false;
try {
  steamAvailable = ipcRenderer.sendSync('steam:isAvailableSync') === true;
} catch {
  steamAvailable = false;
}

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: 'steam',

  // Open external URLs in the OS browser (replaces the Capacitor Browser plugin
  // path on desktop).
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),

  // Steam bridge — forwards to steam.cjs in the main process.
  steam: {
    isAvailable: () => steamAvailable,
    unlockAchievement: (id) => ipcRenderer.invoke('steam:unlockAchievement', id),
    // Mirror a save slot's serialized JSON to the Auto-Cloud folder.
    cloudSave: (slot, blob) => ipcRenderer.invoke('steam:cloudSave', slot, blob),
    // Returns `{ savedAt, payload }` for the slot's cloud mirror, or null.
    cloudLoad: (slot) => ipcRenderer.invoke('steam:cloudLoad', slot),
  },
});
