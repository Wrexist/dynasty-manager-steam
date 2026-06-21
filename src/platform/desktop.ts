// Desktop (Electron / Steam) platform detection.
//
// The Electron preload (electron/preload.cjs) exposes `window.electronAPI`.
// Game/renderer code branches on capability through this helper rather than
// importing Electron or Capacitor directly, so the mobile and web builds are
// completely unaffected (electronAPI is simply absent there).
//
// Phase 2 will grow this module (openExternal wrapper, save-flush hooks, etc.).

interface ElectronAPI {
  isElectron: boolean;
  platform: string;
  openExternal: (url: string) => Promise<void>;
  steam: {
    isAvailable: () => boolean;
    unlockAchievement: (id: string) => Promise<boolean>;
    cloudSave: (slot: number, blob: string) => Promise<boolean>;
    cloudLoad: (slot: number) => Promise<string | null>;
  };
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export function getElectronAPI(): ElectronAPI | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.electronAPI;
}

/** True when running inside the Electron desktop (Steam) wrapper. */
export function isDesktop(): boolean {
  return !!getElectronAPI()?.isElectron;
}

/**
 * Open an external URL via the Electron main process (OS browser).
 * Returns true if handled by the desktop bridge, false otherwise (so callers
 * can fall back to web `window.open`). Never throws.
 */
export function openExternalDesktop(url: string): boolean {
  const api = getElectronAPI();
  if (api?.openExternal) {
    void api.openExternal(url);
    return true;
  }
  return false;
}
