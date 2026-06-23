/**
 * Desktop (Steam) Auto-Cloud save mirror + restore.
 *
 * The cloud mirror is additive on top of the existing IndexedDB/localStorage
 * save layer: every `writeSaveSlot` also pushes the payload to the Steam
 * cloud bridge, and on launch empty slots are restored from the cloud (the
 * cross-machine "load my save on a new PC" case). Conflict resolution
 * (overwriting a local save) is intentionally out of scope — see the note in
 * `restoreCloudSavesIfEmpty`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// In-memory fake of the Steam Auto-Cloud folder, driven through the bridge.
const cloud = vi.hoisted(() => ({
  desktop: false,
  available: false,
  files: new Map<number, { savedAt: number; payload: string }>(),
}));

vi.mock('@/platform/desktop', () => ({
  isDesktop: () => cloud.desktop,
  getElectronAPI: () =>
    cloud.desktop
      ? {
          isElectron: true,
          steam: {
            isAvailable: () => cloud.available,
            cloudSave: (slot: number, blob: string) => {
              cloud.files.set(slot, { savedAt: Date.now(), payload: blob });
              return Promise.resolve(true);
            },
            cloudLoad: (slot: number) => Promise.resolve(cloud.files.get(slot) ?? null),
            unlockAchievement: () => Promise.resolve(true),
          },
        }
      : undefined,
}));

import {
  writeSaveSlot,
  readSaveSlot,
  restoreCloudSavesIfEmpty,
  __resetSaveStorageForTests,
} from '@/store/helpers/persistence';

function validSave(week = 1): string {
  return JSON.stringify({
    version: 1,
    playerClubId: 'arsenal',
    clubs: { arsenal: { id: 'arsenal', name: 'Arsenal' } },
    players: {},
    fixtures: [],
    season: 1,
    week,
    gameMode: 'sandbox',
  });
}

describe('desktop Steam Auto-Cloud save mirror', () => {
  beforeEach(() => {
    __resetSaveStorageForTests();
    localStorage.clear();
    cloud.desktop = false;
    cloud.available = false;
    cloud.files.clear();
  });

  it('does not touch the cloud on non-desktop builds', () => {
    cloud.desktop = false;
    writeSaveSlot(1, validSave());
    expect(cloud.files.size).toBe(0);
  });

  it('mirrors a slot write to the cloud when Steam is available', () => {
    cloud.desktop = true;
    cloud.available = true;
    writeSaveSlot(1, validSave(5));
    expect(cloud.files.get(1)?.payload).toBe(validSave(5));
  });

  it('does not mirror when desktop but Steam is unavailable', () => {
    cloud.desktop = true;
    cloud.available = false;
    writeSaveSlot(1, validSave());
    expect(cloud.files.size).toBe(0);
  });

  it('restores an empty slot from the cloud mirror', async () => {
    cloud.desktop = true;
    cloud.available = true;
    cloud.files.set(2, { savedAt: Date.now(), payload: validSave(9) });

    const restored = await restoreCloudSavesIfEmpty();
    expect(restored).toBe(1);
    expect(readSaveSlot(2)).toBe(validSave(9));
  });

  it('never overwrites a slot that already has a local save', async () => {
    cloud.desktop = true;
    cloud.available = true;
    const local = validSave(1);
    const remote = validSave(99);
    // Seed local first (this also mirrors `local` to the cloud), then force a
    // divergent cloud copy to prove restore leaves the local save intact.
    writeSaveSlot(3, local);
    cloud.files.set(3, { savedAt: Date.now() + 10_000, payload: remote });

    const restored = await restoreCloudSavesIfEmpty();
    expect(restored).toBe(0);
    expect(readSaveSlot(3)).toBe(local);
  });

  it('ignores a corrupt cloud payload instead of adopting it', async () => {
    cloud.desktop = true;
    cloud.available = true;
    cloud.files.set(1, { savedAt: Date.now(), payload: '{ not valid json' });

    const restored = await restoreCloudSavesIfEmpty();
    expect(restored).toBe(0);
    expect(readSaveSlot(1)).toBeNull();
  });
});
