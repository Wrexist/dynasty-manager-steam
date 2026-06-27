// Steam integration for the desktop build — main-process only.
//
// Phase 5 of STEAM_PORT.md. Two independent concerns live here:
//
//  1. Achievements + overlay → the native `steamworks.js` binding. It is a
//     LAZY, OPTIONAL require: the module is a native addon that only builds on
//     a machine with the Steam SDK, and it requires a running Steam client to
//     init. When it is absent (CI, web/dev, or a machine without it installed)
//     every call degrades to a harmless no-op and `isAvailable()` returns
//     false — the app runs identically. Install it on the build box with
//     `npm install steamworks.js` and drop a `steam_appid.txt` next to the
//     binary for local testing (480 = Spacewar, the public test AppID).
//
//  2. Cloud saves → a plain-file mirror under `userData/steamcloud/`, NOT the
//     ISteamRemoteStorage API. This is the Steam *Auto-Cloud* approach: Steam
//     is configured (partner dashboard, 👤) to sync that folder, and the app
//     just reads/writes ordinary JSON files. No `steamworks.js` dependency for
//     this path, so it works and is testable even without the native binding.
//
// ⚠️ NOT YET VERIFIED ON A REAL STEAM CLIENT. The achievement/overlay calls use
// the documented greenheartgames/steamworks.js API surface but the exact method
// names and the overlay launch flags must be confirmed during the on-device
// spike (AppID 480). Every native call is wrapped so a wrong assumption
// degrades to a no-op instead of crashing the app.

const path = require('node:path');
const fs = require('node:fs');

// --- AppID resolution --------------------------------------------------------
// Real AppID lands once Steam Direct is approved. Until then a `steam_appid.txt`
// (containing e.g. `480`) or the STEAM_APPID env var drives local testing.
function resolveAppId() {
  if (process.env.STEAM_APPID && /^\d+$/.test(process.env.STEAM_APPID)) {
    return Number(process.env.STEAM_APPID);
  }
  try {
    const txt = fs.readFileSync(path.join(process.cwd(), 'steam_appid.txt'), 'utf-8').trim();
    if (/^\d+$/.test(txt)) return Number(txt);
  } catch { /* no file — Steam features stay disabled */ }
  return null;
}

let steamworks = null;     // the lazily-required module
let client = null;         // the initialised Steam client (or null)
let initAttempted = false;

/** Lazily require + init steamworks.js. Safe to call repeatedly; the heavy
 *  work runs once. Returns the client or null. Never throws. */
function ensureClient() {
  if (initAttempted) return client;
  initAttempted = true;

  const appId = resolveAppId();
  if (appId == null) {
    console.info('[steam] No AppID configured (steam_appid.txt / STEAM_APPID) — Steam features disabled.');
    return null;
  }

  try {
    steamworks = require('steamworks.js');
  } catch (err) {
    console.info('[steam] steamworks.js not installed — Steam features disabled.', err?.message || err);
    return null;
  }

  try {
    client = steamworks.init(appId);
    console.info(`[steam] Initialised for AppID ${appId}.`);
  } catch (err) {
    console.warn('[steam] init failed (is the Steam client running?) — features disabled.', err?.message || err);
    client = null;
  }
  return client;
}

/** True when the native binding initialised against a running Steam client. */
function isAvailable() {
  return ensureClient() != null;
}

/** Unlock (activate) a Steam achievement by its API name. Idempotent on
 *  Steam's side — re-activating an unlocked achievement is a no-op. Returns
 *  true if the call was dispatched. */
function unlockAchievement(apiName) {
  const c = ensureClient();
  if (!c || typeof apiName !== 'string' || !apiName) return false;
  try {
    // greenheartgames/steamworks.js: client.achievement.activate(name) → bool.
    // ⚠️ confirm method shape during the on-device spike.
    const ok = c.achievement.activate(apiName);
    return ok !== false;
  } catch (err) {
    console.warn(`[steam] unlockAchievement(${apiName}) failed:`, err?.message || err);
    return false;
  }
}

/** Enable the in-game overlay for this Electron renderer. Must be called after
 *  the window exists. Windows-only; no-op elsewhere or when unavailable.
 *  ⚠️ overlay rendering (and the launch flags in main.cjs) must be verified on
 *  a real Steam client — the DirectComposition "white overlay" symptom is the
 *  thing the spike is checking for. */
function enableOverlay() {
  if (process.platform !== 'win32') return;
  if (!isAvailable() || !steamworks) return;
  try {
    if (typeof steamworks.electronEnableSteamOverlay === 'function') {
      steamworks.electronEnableSteamOverlay();
    }
  } catch (err) {
    console.warn('[steam] enableOverlay failed:', err?.message || err);
  }
}

/** Should the Steam-overlay GPU launch flags be applied? They must be set
 *  before `app.whenReady`, before we can init the client, so we gate on AppID
 *  presence + win32 instead. Benign when Steam isn't actually running. */
function shouldApplyOverlayFlags() {
  return process.platform === 'win32' && resolveAppId() != null;
}

// --- Cloud saves (Auto-Cloud file mirror) ------------------------------------
// These are plain files; Steam Auto-Cloud (dashboard config) handles the
// cross-machine sync. Envelope wraps the raw save payload with a wall-clock
// timestamp so the renderer can resolve which copy is newer on launch.

const CLOUD_ENVELOPE_VERSION = 1;

function cloudDir(userDataPath) {
  return path.join(userDataPath, 'steamcloud');
}

function cloudFile(userDataPath, slot) {
  return path.join(cloudDir(userDataPath), `slot${slot}.sav`);
}

/** Mirror a save payload to the Auto-Cloud folder. Atomic (tmp + rename) so a
 *  crash mid-write never leaves a truncated save Steam would then sync. */
function cloudSave(userDataPath, slot, payload) {
  if (!Number.isInteger(slot) || typeof payload !== 'string') return false;
  try {
    const dir = cloudDir(userDataPath);
    fs.mkdirSync(dir, { recursive: true });
    const envelope = JSON.stringify({
      version: CLOUD_ENVELOPE_VERSION,
      savedAt: Date.now(),
      slot,
      payload,
    });
    const target = cloudFile(userDataPath, slot);
    const tmp = `${target}.tmp`;
    fs.writeFileSync(tmp, envelope);
    fs.renameSync(tmp, target);
    return true;
  } catch (err) {
    console.warn(`[steam] cloudSave(slot ${slot}) failed:`, err?.message || err);
    return false;
  }
}

/** Read the mirrored save for a slot. Returns `{ savedAt, payload }` or null.
 *  Tolerates a legacy raw-string file (no envelope) for forward safety. */
function cloudLoad(userDataPath, slot) {
  if (!Number.isInteger(slot)) return null;
  try {
    const raw = fs.readFileSync(cloudFile(userDataPath, slot), 'utf-8');
    try {
      const env = JSON.parse(raw);
      if (env && typeof env.payload === 'string') {
        return { savedAt: Number(env.savedAt) || 0, payload: env.payload };
      }
      // Parsed but not our envelope — treat the whole thing as the payload.
      return { savedAt: 0, payload: raw };
    } catch {
      // Not JSON at all — treat as a raw payload string.
      return { savedAt: 0, payload: raw };
    }
  } catch {
    return null; // no cloud file for this slot
  }
}

module.exports = {
  isAvailable,
  unlockAchievement,
  enableOverlay,
  shouldApplyOverlayFlags,
  cloudSave,
  cloudLoad,
};
