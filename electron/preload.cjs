// Electron preload — the ONLY bridge between the sandboxed renderer and the
// main process. Keep the surface minimal and Steam-agnostic.
//
// The renderer detects the desktop build via `window.electronAPI?.isElectron`.
// The `steam` namespace is a no-op stub in Phase 1; real Steamworks calls are
// wired into the main process in Phase 5 and exposed through these same methods,
// so renderer/game code can call them today without changing later.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: 'steam',

  // Open external URLs in the OS browser (replaces the Capacitor Browser plugin
  // path on desktop — wired up in Phase 2).
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),

  // Steam bridge — stubbed until Phase 5. Methods resolve harmlessly so callers
  // never need to branch on availability beyond `isAvailable()`.
  steam: {
    isAvailable: () => false,
    unlockAchievement: (_id) => Promise.resolve(false),
    cloudSave: (_slot, _blob) => Promise.resolve(false),
    cloudLoad: (_slot) => Promise.resolve(null),
  },
});
