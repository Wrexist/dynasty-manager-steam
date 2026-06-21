// Steam achievement bridge (desktop / Steam build only).
//
// The game already tracks achievements in `unlockedAchievements` (see
// `src/utils/achievements.ts` + the unlock chokepoint in weekAdvance). Rather
// than invent new event hooks, this module observes that array and mirrors each
// newly-unlocked in-game achievement to Steam. On mobile/web the Electron
// bridge is absent, so every function here is an inert no-op.
//
// Steam's `activate` is idempotent (re-activating an unlocked achievement does
// nothing), so re-firing is always safe — we reconcile the full set once at
// startup and then fire deltas as they happen.
//
// ⚠️ The Steam-side achievement list (partner dashboard, 👤) must define API
// names that match `steamAchievementApiName(id)` for every in-game achievement
// we want surfaced — e.g. in-game `champions-cup-winner` → Steam
// `CHAMPIONS_CUP_WINNER`. See the export list at the bottom for the full map.

import { getElectronAPI, isDesktop } from '@/platform/desktop';
import { ACHIEVEMENTS } from '@/utils/achievements';
import { useGameStore } from '@/store/gameStore';

/** Normalise an in-game achievement id (kebab-case) to a Steam API name
 *  (UPPER_SNAKE). Deterministic so the dashboard list can be generated from
 *  `steamAchievementApiNames()`. */
export function steamAchievementApiName(id: string): string {
  return id.toUpperCase().replace(/-/g, '_');
}

/** Every Steam API name the game can unlock, derived from the in-game
 *  achievement list. Use this to populate the Steamworks dashboard. */
export function steamAchievementApiNames(): string[] {
  return ACHIEVEMENTS.map(a => steamAchievementApiName(a.id));
}

/** True when the Steam achievement bridge is live (desktop + Steam running). */
function steamReady(): boolean {
  if (!isDesktop()) return false;
  const api = getElectronAPI();
  return !!api?.steam?.isAvailable?.();
}

/** Fire Steam unlocks for a set of in-game achievement ids. No-op off-Steam.
 *  Fire-and-forget — a failed unlock never affects game flow. */
export function unlockSteamAchievements(ids: string[]): void {
  if (!ids.length || !steamReady()) return;
  const steam = getElectronAPI()?.steam;
  if (!steam) return;
  for (const id of ids) {
    try {
      void steam.unlockAchievement(steamAchievementApiName(id));
    } catch {
      /* bridge error — non-fatal, achievement simply isn't mirrored */
    }
  }
}

/** Push the full current achievement set to Steam (idempotent). Run once at
 *  startup so achievements earned before Steam was wired — or on a fresh
 *  machine after a cloud restore — are reconciled. */
export function reconcileSteamAchievements(): void {
  if (!steamReady()) return;
  unlockSteamAchievements(useGameStore.getState().unlockedAchievements);
}

/** Start mirroring achievement unlocks to Steam. Subscribes to the store and
 *  fires a Steam unlock for each id added to `unlockedAchievements`. Returns an
 *  unsubscribe fn. No-op (returns a noop unsubscribe) off the Steam build. */
export function initSteamAchievementSync(): () => void {
  if (!steamReady()) return () => {};

  // Reconcile what's already unlocked (e.g. after loading a save), then watch
  // for new unlocks and mirror only the delta.
  reconcileSteamAchievements();

  let previous = useGameStore.getState().unlockedAchievements;
  return useGameStore.subscribe((state) => {
    const current = state.unlockedAchievements;
    if (current === previous) return;
    const prevSet = new Set(previous);
    const added = current.filter(id => !prevSet.has(id));
    previous = current;
    if (added.length) unlockSteamAchievements(added);
  });
}
