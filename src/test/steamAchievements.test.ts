import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mutable mock for the desktop/Steam bridge so each test can flip availability.
const h = vi.hoisted(() => ({
  desktop: false,
  available: false,
  unlock: vi.fn((_id: string) => Promise.resolve(true)),
}));

vi.mock('@/platform/desktop', () => ({
  isDesktop: () => h.desktop,
  getElectronAPI: () =>
    h.desktop
      ? { isElectron: true, steam: { isAvailable: () => h.available, unlockAchievement: h.unlock } }
      : undefined,
}));

import {
  steamAchievementApiName,
  steamAchievementApiNames,
  unlockSteamAchievements,
  initSteamAchievementSync,
} from '@/utils/steamAchievements';
import { useGameStore } from '@/store/gameStore';

describe('steamAchievements', () => {
  beforeEach(() => {
    h.desktop = false;
    h.available = false;
    h.unlock.mockClear();
  });

  it('normalises in-game ids to Steam UPPER_SNAKE API names', () => {
    expect(steamAchievementApiName('first-win')).toBe('FIRST_WIN');
    expect(steamAchievementApiName('champions-cup-winner')).toBe('CHAMPIONS_CUP_WINNER');
  });

  it('derives the dashboard API-name list from the achievement catalogue', () => {
    const names = steamAchievementApiNames();
    expect(names).toContain('FIRST_WIN');
    expect(names).toContain('LEAGUE_CHAMPION');
    // All names are valid Steam API identifiers (UPPER_SNAKE, no hyphens).
    expect(names.every(n => /^[A-Z0-9_]+$/.test(n))).toBe(true);
  });

  it('is a no-op when not running on the desktop build', () => {
    h.desktop = false;
    unlockSteamAchievements(['first-win']);
    expect(h.unlock).not.toHaveBeenCalled();
  });

  it('is a no-op on desktop when Steam itself is unavailable', () => {
    h.desktop = true;
    h.available = false;
    unlockSteamAchievements(['first-win']);
    expect(h.unlock).not.toHaveBeenCalled();
  });

  it('fires Steam unlocks with normalised names when available', () => {
    h.desktop = true;
    h.available = true;
    unlockSteamAchievements(['first-win', 'cup-winner']);
    expect(h.unlock).toHaveBeenCalledTimes(2);
    expect(h.unlock).toHaveBeenCalledWith('FIRST_WIN');
    expect(h.unlock).toHaveBeenCalledWith('CUP_WINNER');
  });

  it('mirrors only newly-unlocked achievements via the store subscription', () => {
    h.desktop = true;
    h.available = true;
    useGameStore.setState({ unlockedAchievements: ['first-win'] });

    const unsub = initSteamAchievementSync();
    // Reconciles the existing set on init.
    expect(h.unlock).toHaveBeenCalledWith('FIRST_WIN');
    h.unlock.mockClear();

    // Adding one new achievement fires exactly that delta.
    useGameStore.setState({ unlockedAchievements: ['first-win', 'league-champion'] });
    expect(h.unlock).toHaveBeenCalledTimes(1);
    expect(h.unlock).toHaveBeenCalledWith('LEAGUE_CHAMPION');

    // After unsubscribing, no further unlocks fire.
    unsub();
    h.unlock.mockClear();
    useGameStore.setState({ unlockedAchievements: ['first-win', 'league-champion', 'cup-winner'] });
    expect(h.unlock).not.toHaveBeenCalled();
  });
});
