/**
 * loanSlice — processLoanReturns + buyLoanedPlayer (the multi-club state
 * machine). loanSlice.test.ts covers loanOut; these guard the return/buy paths
 * where the playerIds/lineup/clubId consistency gotcha (CLAUDE.md) is most
 * dangerous: a return that strands a player or a buy that doesn't move budget.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import type { GameState } from '@/store/storeTypes';
import type { Club, Player, LoanDeal } from '@/types/game';

const PARENT = 'parent-fc';
const BORROW = 'borrow-fc';
const PID = 'loanee';

function club(id: string, over: Partial<Club> = {}): Club {
  return { id, name: id, shortName: id, budget: 50_000_000, wageBill: 0,
    playerIds: [], lineup: [], subs: [], ...over } as unknown as Club;
}
function loanee(): Player {
  return { id: PID, firstName: 'Loan', lastName: 'Ee', overall: 78, wage: 50_000,
    clubId: BORROW, onLoan: true, loanFromClubId: PARENT, loanToClubId: BORROW } as unknown as Player;
}
function loan(over: Partial<LoanDeal> = {}): LoanDeal {
  return { id: 'loan-1', playerId: PID, fromClubId: PARENT, toClubId: BORROW,
    startWeek: 1, startSeason: 1, durationWeeks: 4, wageSplit: 50, recallClause: false, ...over };
}
const set = (p: Partial<GameState>) => useGameStore.setState(p as Partial<ReturnType<typeof useGameStore.getState>>);

/** Player currently sits in the borrowing club's roster (loan state). */
function seedLoan(over: { loan?: Partial<LoanDeal>; parentBudget?: number; borrowBudget?: number } = {}) {
  set({
    season: 1, week: 40, playerClubId: BORROW,
    players: { [PID]: loanee() },
    clubs: {
      [PARENT]: club(PARENT, { budget: over.parentBudget ?? 50_000_000 }),
      [BORROW]: club(BORROW, { budget: over.borrowBudget ?? 50_000_000, playerIds: [PID], subs: [PID] }),
    },
    activeLoans: [loan(over.loan)],
    freeAgents: [], messages: [], shortlist: [], scoutWatchList: [], transferMarket: [],
  } as Partial<GameState>);
}

describe('loanSlice — processLoanReturns', () => {
  beforeEach(() => seedLoan());

  it('returns an expired loan to the parent club and clears loan flags', () => {
    useGameStore.getState().processLoanReturns(true); // forceAll
    const s = useGameStore.getState();
    expect(s.players[PID].clubId).toBe(PARENT);
    expect(s.players[PID].onLoan).toBe(false);
    expect(s.clubs[PARENT].playerIds).toContain(PID);
    expect(s.clubs[BORROW].playerIds).not.toContain(PID);
    expect(s.clubs[BORROW].subs).not.toContain(PID); // removed from borrower lineup/subs
    expect(s.activeLoans).toHaveLength(0);
  });

  it('does not return a loan that has not elapsed (without forceAll)', () => {
    set({ season: 1, week: 2 } as Partial<GameState>); // elapsed 1 < duration 4
    useGameStore.getState().processLoanReturns();
    expect(useGameStore.getState().activeLoans).toHaveLength(1);
    expect(useGameStore.getState().players[PID].clubId).toBe(BORROW);
  });

  it('activates an affordable obligatory buy into a permanent transfer', () => {
    seedLoan({ loan: { obligatoryBuyFee: 10_000_000 }, parentBudget: 1_000_000, borrowBudget: 30_000_000 });
    useGameStore.getState().processLoanReturns(true);
    const s = useGameStore.getState();
    expect(s.players[PID].clubId).toBe(BORROW); // stays at borrower permanently
    expect(s.clubs[BORROW].playerIds).toContain(PID);
    expect(s.clubs[PARENT].budget).toBe(11_000_000); // +fee
    expect(s.clubs[BORROW].budget).toBe(20_000_000); // -fee
    expect(s.activeLoans).toHaveLength(0);
  });

  it('returns the player to the parent when an obligatory buy is unaffordable (no budget change)', () => {
    seedLoan({ loan: { obligatoryBuyFee: 10_000_000 }, borrowBudget: 1_000_000 });
    useGameStore.getState().processLoanReturns(true);
    const s = useGameStore.getState();
    expect(s.players[PID].clubId).toBe(PARENT); // reverted to parent
    expect(s.clubs[BORROW].budget).toBe(1_000_000); // untouched
  });

  it('releases the player to free agency if a club was removed (promotion/relegation)', () => {
    // Drop the borrowing club to simulate it being wiped by the cascade.
    const s0 = useGameStore.getState();
    set({ clubs: { [PARENT]: s0.clubs[PARENT] } } as Partial<GameState>); // BORROW gone
    useGameStore.getState().processLoanReturns(true);
    const s = useGameStore.getState();
    expect(s.players[PID].clubId).toBe('');
    expect(s.freeAgents).toContain(PID);
    expect(s.activeLoans).toHaveLength(0);
  });
});

describe('loanSlice — buyLoanedPlayer', () => {
  beforeEach(() => seedLoan({ loan: { obligatoryBuyFee: 8_000_000 } }));

  it('converts the loan to a permanent deal, moving budget and roster', () => {
    set({ playerClubId: BORROW } as Partial<GameState>);
    const res = useGameStore.getState().buyLoanedPlayer('loan-1');
    expect(res.success).toBe(true);
    const s = useGameStore.getState();
    expect(s.players[PID].clubId).toBe(BORROW);
    expect(s.clubs[BORROW].playerIds).toContain(PID);
    expect(s.clubs[PARENT].playerIds).not.toContain(PID);
    expect(s.clubs[PARENT].budget).toBe(58_000_000); // +fee
    expect(s.clubs[BORROW].budget).toBe(42_000_000); // -fee
    expect(s.activeLoans).toHaveLength(0);
  });

  it('refuses when the buyer cannot afford the fee (no state change)', () => {
    seedLoan({ loan: { obligatoryBuyFee: 8_000_000 }, borrowBudget: 1_000_000 });
    set({ playerClubId: BORROW } as Partial<GameState>);
    const res = useGameStore.getState().buyLoanedPlayer('loan-1');
    expect(res.success).toBe(false);
    expect(useGameStore.getState().activeLoans).toHaveLength(1);
    expect(useGameStore.getState().clubs[BORROW].budget).toBe(1_000_000);
  });

  it('refuses to buy a player who is not on loan to your club', () => {
    set({ playerClubId: PARENT } as Partial<GameState>); // not the borrower
    const res = useGameStore.getState().buyLoanedPlayer('loan-1');
    expect(res.success).toBe(false);
  });
});
