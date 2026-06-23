/**
 * careerSlice — manager state transitions (resign / retire / respond to offer).
 * careerSlice.test covers the sandbox-mode guards and managerCareer.test covers
 * the util layer (54 tests); this guards the slice's career-mode transitions:
 * resign and retire close the open history entry correctly, and respondToJobOffer
 * reject/guard branches behave (the accept→moveToNewClub path is exercised by
 * the existing managerCareer flow).
 */
import { describe, it, expect } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import type { GameState } from '@/store/storeTypes';
import type { CareerManager, JobOffer } from '@/types/game';

function manager(over: Partial<CareerManager> = {}): CareerManager {
  return {
    name: 'Test Boss', age: 45, reputationScore: 50, resignedCount: 0, unemployedWeeks: 0,
    contract: { clubId: 'club-a', salary: 100_000, seasonsTotal: 3, seasonsRemaining: 2, bonuses: [] },
    careerHistory: [{ clubId: 'club-a', clubName: 'Club A', startSeason: 1, endSeason: null, reason: null }],
    attributes: { tacticalKnowledge: 50, negotiation: 50, manManagement: 50, youthDevelopment: 50, mediaHandling: 50 },
    ...over,
  } as unknown as CareerManager;
}

function seed(over: Partial<GameState> = {}) {
  useGameStore.setState({
    gameMode: 'career', season: 2, week: 5, playerClubId: 'club-a',
    careerManager: manager(), jobOffers: [], clubs: {}, messages: [], careerTimeline: [],
    ...over,
  } as Partial<GameState> as never);
}
const cm = () => useGameStore.getState().careerManager!;

describe('careerSlice — resignFromClub', () => {
  it('clears the contract, closes the history entry as resigned, and bumps the count', () => {
    seed();
    useGameStore.getState().resignFromClub();
    const m = cm();
    expect(m.contract).toBeNull();
    expect(m.resignedCount).toBe(1);
    const open = m.careerHistory.find(h => h.clubId === 'club-a');
    expect(open?.endSeason).toBe(2);
    expect(open?.reason).toBe('resigned');
  });

  it('is a no-op when the manager has no contract', () => {
    seed({ careerManager: manager({ contract: null }) });
    useGameStore.getState().resignFromClub();
    expect(cm().resignedCount).toBe(0); // unchanged
  });
});

describe('careerSlice — retireManager', () => {
  it('clears the contract, marks history retired, and routes to the Hall of Managers', () => {
    seed();
    useGameStore.getState().retireManager();
    const s = useGameStore.getState();
    expect(s.careerManager!.contract).toBeNull();
    expect(s.careerManager!.careerHistory.find(h => h.clubId === 'club-a')?.reason).toBe('retired');
    expect(s.currentScreen).toBe('hall-of-managers');
  });
});

describe('careerSlice — respondToJobOffer', () => {
  const offer: JobOffer = { id: 'jo-1', clubId: 'club-b' } as unknown as JobOffer;

  it('rejecting an offer removes it from the list', () => {
    seed({ jobOffers: [offer] });
    const res = useGameStore.getState().respondToJobOffer('jo-1', false);
    expect(res.success).toBe(true);
    expect(useGameStore.getState().jobOffers).toHaveLength(0);
  });

  it('fails for an unknown offer id', () => {
    seed({ jobOffers: [offer] });
    expect(useGameStore.getState().respondToJobOffer('ghost', true).success).toBe(false);
  });

  it('blocks a retired-age manager from accepting a new job', () => {
    seed({ jobOffers: [offer], careerManager: manager({ age: 75 }) }); // past retirement age
    const res = useGameStore.getState().respondToJobOffer('jo-1', true);
    expect(res.success).toBe(false);
    // The offer is not consumed and no club move happened.
    expect(useGameStore.getState().jobOffers).toHaveLength(1);
  });
});
