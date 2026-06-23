/**
 * transferSlice — the budget+roster actions: executeTransfer (buy), signFreeAgent,
 * releasePlayer, renewContract. transferSlice.test covers shortlist/strikes and
 * respondToOffer (the sell side); these guard the buy/sign/release/renew side
 * where the playerIds/clubId/budget consistency gotcha (CLAUDE.md) lives.
 *
 * Each test seeds a COMPLETE state (the store is a singleton, so partial patches
 * leak between tests).
 */
import { describe, it, expect } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { MIN_SQUAD_SIZE } from '@/config/gameBalance';
import type { GameState } from '@/store/storeTypes';
import type { Club, Player } from '@/types/game';

const BUYER = 'buyer-fc';
const SELLER = 'seller-fc';

function club(id: string, over: Partial<Club> = {}): Club {
  return { id, name: id, shortName: id, budget: 50_000_000, wageBill: 0, reputation: 80,
    playerIds: [], lineup: [], subs: [], ...over } as unknown as Club;
}
function player(id: string, over: Partial<Player> = {}): Player {
  return { id, firstName: 'P', lastName: id, overall: 60, value: 5_000_000, wage: 40_000,
    age: 24, position: 'CM', clubId: SELLER, onLoan: false, contractEnd: 5, morale: 70,
    listedForSale: false, ...over } as unknown as Player;
}

/** Seed a full, self-contained transfer state. */
function seed(over: Partial<GameState> = {}) {
  useGameStore.setState({
    season: 1, week: 3, totalWeeks: 46, playerClubId: BUYER, playerDivision: 'eng',
    transferWindowOpen: true, gameMode: 'sandbox', activeChallenge: null,
    players: {}, clubs: {},
    transferMarket: [], shortlist: [], scoutWatchList: [], freeAgents: [],
    seasonTransfersBought: [], managerStats: { totalSpent: 0 } as GameState['managerStats'],
    careerTimeline: [], messages: [], financeHistory: [], staff: { members: [] } as GameState['staff'],
    incomingOffers: [], incomingLoanOffers: [], outgoingLoanRequests: [], activeLoans: [],
    negotiationStrikes: {}, contractStrikes: {}, pendingFarewell: [], pendingTransferTalk: null,
    merchandise: useGameStore.getState().merchandise,
    ...over,
  } as Partial<GameState> as never);
}

function fillSquad(n: number): { ids: string[]; players: Record<string, Player> } {
  const ids: string[] = [];
  const players: Record<string, Player> = {};
  for (let i = 0; i < n; i++) { const id = `filler-${i}`; ids.push(id); players[id] = player(id, { clubId: BUYER }); }
  return { ids, players };
}

describe('transferSlice — executeTransfer (buy)', () => {
  function seedBuy(targetOver: Partial<Player> = {}) {
    seed({
      players: { target: player('target', targetOver) },
      clubs: { [BUYER]: club(BUYER), [SELLER]: club(SELLER, { playerIds: ['target'], wageBill: 40_000 }) },
    });
  }

  it('moves the player to the buyer and shifts budget both ways', () => {
    seedBuy();
    const res = useGameStore.getState().executeTransfer('target', 10_000_000);
    expect(res.success).toBe(true);
    const s = useGameStore.getState();
    expect(s.players.target.clubId).toBe(BUYER);
    expect(s.clubs[BUYER].playerIds).toContain('target');
    expect(s.clubs[SELLER].playerIds).not.toContain('target');
    expect(s.clubs[BUYER].budget).toBe(40_000_000); // -10M
    expect(s.clubs[SELLER].budget).toBe(60_000_000); // +10M
  });

  it('refuses when the fee exceeds the budget (no state change)', () => {
    seedBuy();
    const res = useGameStore.getState().executeTransfer('target', 999_000_000);
    expect(res.success).toBe(false);
    expect(useGameStore.getState().players.target.clubId).toBe(SELLER);
  });

  it('refuses to sign a player who is on loan', () => {
    seedBuy({ onLoan: true });
    const res = useGameStore.getState().executeTransfer('target', 10_000_000);
    expect(res.success).toBe(false);
  });
});

describe('transferSlice — signFreeAgent', () => {
  function seedFA(over: Partial<GameState> = {}) {
    seed({
      players: { fa: player('fa', { clubId: '', overall: 55 }) },
      clubs: { [BUYER]: club(BUYER, { reputation: 85 }) },
      freeAgents: ['fa'], ...over,
    });
  }

  it('signs a free agent and removes them from the pool', () => {
    seedFA();
    const res = useGameStore.getState().signFreeAgent('fa', 30_000, 3);
    expect(res.success).toBe(true);
    const s = useGameStore.getState();
    expect(s.players.fa.clubId).toBe(BUYER);
    expect(s.clubs[BUYER].playerIds).toContain('fa');
    expect(s.freeAgents).not.toContain('fa');
    expect(s.clubs[BUYER].budget).toBeLessThan(50_000_000); // signing bonus paid
  });

  it('refuses a player who is not a free agent', () => {
    seedFA({ freeAgents: [] });
    expect(useGameStore.getState().signFreeAgent('fa', 30_000, 3).success).toBe(false);
  });
});

describe('transferSlice — releasePlayer', () => {
  function seedRelease(squadSize: number) {
    const sq = fillSquad(squadSize);
    seed({
      week: 46, // season-end week → 0 severance (contractEnd === season)
      players: { ...sq.players, rel: player('rel', { clubId: BUYER, contractEnd: 1 }) },
      clubs: { [BUYER]: club(BUYER, { playerIds: [...sq.ids, 'rel'] }) },
    });
  }

  it('releases the player to free agency and removes them from the squad', () => {
    seedRelease(MIN_SQUAD_SIZE + 2);
    const res = useGameStore.getState().releasePlayer('rel');
    expect(res.success).toBe(true);
    const s = useGameStore.getState();
    expect(s.players.rel.clubId).toBe('');
    expect(s.clubs[BUYER].playerIds).not.toContain('rel');
    expect(s.freeAgents).toContain('rel');
  });

  it('refuses when releasing would drop the squad below the minimum', () => {
    seedRelease(MIN_SQUAD_SIZE - 1); // squad = MIN (fillers + rel)
    expect(useGameStore.getState().releasePlayer('rel').success).toBe(false);
  });
});

describe('transferSlice — renewContract', () => {
  function seedRenew() {
    seed({
      season: 2,
      players: { keep: player('keep', { clubId: BUYER, contractEnd: 3, wage: 40_000 }) },
      clubs: { [BUYER]: club(BUYER) },
    });
  }

  it('extends the contract and updates the wage', () => {
    seedRenew();
    const res = useGameStore.getState().renewContract('keep', 4, 60_000);
    expect(res.success).toBe(true);
    const s = useGameStore.getState();
    expect(s.players.keep.contractEnd).toBe(6); // season 2 + 4
    expect(s.players.keep.wage).toBe(60_000);
    expect(s.clubs[BUYER].budget).toBeLessThan(50_000_000); // signing bonus paid
  });

  it('refuses an out-of-range contract length', () => {
    seedRenew();
    expect(useGameStore.getState().renewContract('keep', 9, 60_000).success).toBe(false);
  });
});
