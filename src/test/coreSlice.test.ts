/**
 * coreSlice — screen navigation, match-lock, and unemployed-career redirects.
 * These guards keep the player from navigating out of a live match or into
 * club-management screens while unemployed in career mode.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import type { GameState } from '@/store/storeTypes';

const set = (partial: Partial<GameState>) =>
  useGameStore.setState(partial as Partial<ReturnType<typeof useGameStore.getState>>);

describe('coreSlice — setScreen', () => {
  beforeEach(() => {
    set({ gameMode: 'sandbox', careerManager: null, currentScreen: 'dashboard', matchPhase: 'none', previousScreen: null } as Partial<GameState>);
  });

  it('navigates and records the previous screen', () => {
    useGameStore.getState().setScreen('squad');
    expect(useGameStore.getState().currentScreen).toBe('squad');
    expect(useGameStore.getState().previousScreen).toBe('dashboard');
  });

  it('is blocked mid-match for a disallowed target', () => {
    set({ currentScreen: 'match', matchPhase: 'first_half' } as Partial<GameState>);
    useGameStore.getState().setScreen('squad');
    expect(useGameStore.getState().currentScreen).toBe('match'); // stayed put
  });

  it('still allows match-review while a match is live', () => {
    set({ currentScreen: 'match', matchPhase: 'first_half' } as Partial<GameState>);
    useGameStore.getState().setScreen('match-review');
    expect(useGameStore.getState().currentScreen).toBe('match-review');
  });

  it('redirects an unemployed career manager to the job market for restricted screens', () => {
    set({ gameMode: 'career', careerManager: { contract: null, careerHistory: [] } as unknown as GameState['careerManager'], currentScreen: 'job-market' } as Partial<GameState>);
    useGameStore.getState().setScreen('squad'); // not in UNEMPLOYED_ALLOWED_SCREENS
    expect(useGameStore.getState().currentScreen).toBe('job-market');
  });

  it('allows an unemployed manager onto whitelisted screens (e.g. inbox)', () => {
    set({ gameMode: 'career', careerManager: { contract: null, careerHistory: [] } as unknown as GameState['careerManager'], currentScreen: 'job-market' } as Partial<GameState>);
    useGameStore.getState().setScreen('inbox');
    expect(useGameStore.getState().currentScreen).toBe('inbox');
  });

  it('does not restrict a retired manager', () => {
    set({ gameMode: 'career', careerManager: { contract: null, careerHistory: [{ reason: 'retired' }] } as unknown as GameState['careerManager'], currentScreen: 'dashboard' } as Partial<GameState>);
    useGameStore.getState().setScreen('squad');
    expect(useGameStore.getState().currentScreen).toBe('squad');
  });
});

describe('coreSlice — selectPlayer / selectClub', () => {
  beforeEach(() => {
    set({ gameMode: 'sandbox', careerManager: null, currentScreen: 'squad', matchPhase: 'none', selectedPlayerId: null, selectedClubId: null } as Partial<GameState>);
  });

  it('selectPlayer sets the id and opens player-detail', () => {
    useGameStore.getState().selectPlayer('p1');
    expect(useGameStore.getState().selectedPlayerId).toBe('p1');
    expect(useGameStore.getState().currentScreen).toBe('player-detail');
  });

  it('selectClub sets the id and opens team-detail', () => {
    useGameStore.getState().selectClub('c1');
    expect(useGameStore.getState().selectedClubId).toBe('c1');
    expect(useGameStore.getState().currentScreen).toBe('team-detail');
  });

  it('selectPlayer is blocked mid-match', () => {
    set({ currentScreen: 'match', matchPhase: 'first_half' } as Partial<GameState>);
    useGameStore.getState().selectPlayer('p1');
    expect(useGameStore.getState().currentScreen).toBe('match');
  });
});

describe('coreSlice — messages & settings', () => {
  beforeEach(() => {
    set({ gameStarted: false, messages: [
      { id: 'm1', read: false } as GameState['messages'][number],
      { id: 'm2', read: false } as GameState['messages'][number],
    ] } as Partial<GameState>);
  });

  it('markMessageRead flips only the targeted message', () => {
    useGameStore.getState().markMessageRead('m1');
    const msgs = useGameStore.getState().messages;
    expect(msgs.find(m => m.id === 'm1')?.read).toBe(true);
    expect(msgs.find(m => m.id === 'm2')?.read).toBe(false);
  });

  it('markAllRead flips every message', () => {
    useGameStore.getState().markAllRead();
    expect(useGameStore.getState().messages.every(m => m.read)).toBe(true);
  });

  it('updateSettings merges without dropping existing keys', () => {
    const before = useGameStore.getState().settings.matchSpeed;
    useGameStore.getState().updateSettings({ reducedMotion: true });
    expect(useGameStore.getState().settings.reducedMotion).toBe(true);
    expect(useGameStore.getState().settings.matchSpeed).toBe(before); // untouched
  });

  it('updateSettings does not trigger a save when the game has not started', () => {
    const spy = vi.spyOn(useGameStore.getState(), 'saveGame');
    useGameStore.getState().updateSettings({ hapticsEnabled: false });
    expect(spy).not.toHaveBeenCalled();
  });
});
