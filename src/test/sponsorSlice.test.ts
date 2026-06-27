/**
 * sponsorSlice — money-touching actions + season-end bonus processing.
 *
 * sponsorship.test.ts covers the config helpers (getSponsorById, isSlotUnlocked)
 * but not the slice actions that move real budget. These regressions guard the
 * sign/reject/terminate flow (incl. the unaffordable-buyout refusal that keeps
 * the budget from going negative) and the season-end performance-bonus payout.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { processSponsorSeasonEnd } from '@/store/slices/sponsorSlice';
import { useGameStore } from '@/store/gameStore';
import type { GameState } from '@/store/storeTypes';
import type { SponsorOffer, SponsorDeal, Club, LeagueTableEntry } from '@/types/game';

const CLUB_ID = 'test-club';

function mkClub(budget: number): Club {
  return { id: CLUB_ID, name: 'Test FC', shortName: 'TFC', budget, wageBill: 0, reputation: 50,
    playerIds: [], lineup: [], subs: [] } as unknown as Club;
}
function mkOffer(over: Partial<SponsorOffer> = {}): SponsorOffer {
  return { id: 'offer-1', sponsorId: 'apex_tech', slotId: 'kit_sleeve', weeklyPayment: 100_000,
    seasonDuration: 2, performanceBonus: 5_000_000, bonusCondition: 'win_league', buyoutCost: 2_000_000,
    expiresWeek: 20, ...over };
}
function mkDeal(over: Partial<SponsorDeal> = {}): SponsorDeal {
  return { id: 'deal-1', sponsorId: 'apex_tech', slotId: 'kit_sleeve', weeklyPayment: 100_000,
    seasonDuration: 2, startSeason: 1, performanceBonus: 5_000_000, bonusCondition: 'win_league',
    bonusMet: false, satisfaction: 60, buyoutCost: 2_000_000, ...over };
}
const set = (partial: Partial<GameState>) =>
  useGameStore.setState(partial as Partial<ReturnType<typeof useGameStore.getState>>);

describe('sponsorSlice — actions', () => {
  beforeEach(() => {
    set({ week: 5, season: 1, playerClubId: CLUB_ID, clubs: { [CLUB_ID]: mkClub(10_000_000) },
      facilities: {} as GameState['facilities'], sponsorOffers: [], sponsorDeals: [],
      sponsorSlotCooldowns: {}, messages: [] } as Partial<GameState>);
  });

  it('acceptSponsorOffer signs the deal and removes the offer', () => {
    set({ sponsorOffers: [mkOffer()] } as Partial<GameState>);
    useGameStore.getState().acceptSponsorOffer('offer-1');
    const s = useGameStore.getState();
    expect(s.sponsorDeals).toHaveLength(1);
    expect(s.sponsorDeals[0].slotId).toBe('kit_sleeve');
    expect(s.sponsorOffers).toHaveLength(0);
  });

  it('acceptSponsorOffer is rejected when the slot is already occupied', () => {
    set({ sponsorOffers: [mkOffer()], sponsorDeals: [mkDeal()] } as Partial<GameState>);
    useGameStore.getState().acceptSponsorOffer('offer-1');
    expect(useGameStore.getState().sponsorDeals).toHaveLength(1); // unchanged
  });

  it('acceptSponsorOffer is rejected when the offer has expired', () => {
    set({ week: 25, sponsorOffers: [mkOffer({ expiresWeek: 20 })] } as Partial<GameState>);
    useGameStore.getState().acceptSponsorOffer('offer-1');
    expect(useGameStore.getState().sponsorDeals).toHaveLength(0);
  });

  it('acceptSponsorOffer is rejected when the slot is on cooldown', () => {
    set({ sponsorOffers: [mkOffer()], sponsorSlotCooldowns: { kit_sleeve: 99 } } as Partial<GameState>);
    useGameStore.getState().acceptSponsorOffer('offer-1');
    expect(useGameStore.getState().sponsorDeals).toHaveLength(0);
  });

  it('rejectSponsorOffer removes the offer without signing', () => {
    set({ sponsorOffers: [mkOffer()] } as Partial<GameState>);
    useGameStore.getState().rejectSponsorOffer('offer-1');
    expect(useGameStore.getState().sponsorOffers).toHaveLength(0);
    expect(useGameStore.getState().sponsorDeals).toHaveLength(0);
  });

  it('terminateSponsorDeal deducts the buyout and sets a slot cooldown', () => {
    set({ sponsorDeals: [mkDeal({ buyoutCost: 2_000_000 })], clubs: { [CLUB_ID]: mkClub(10_000_000) } } as Partial<GameState>);
    useGameStore.getState().terminateSponsorDeal('deal-1');
    const s = useGameStore.getState();
    expect(s.sponsorDeals).toHaveLength(0);
    expect(s.clubs[CLUB_ID].budget).toBe(8_000_000);
    expect(s.sponsorSlotCooldowns.kit_sleeve).toBeGreaterThan(s.week);
  });

  it('terminateSponsorDeal refuses when the buyout is unaffordable (no negative budget)', () => {
    set({ sponsorDeals: [mkDeal({ buyoutCost: 9_000_000 })], clubs: { [CLUB_ID]: mkClub(1_000_000) } } as Partial<GameState>);
    useGameStore.getState().terminateSponsorDeal('deal-1');
    const s = useGameStore.getState();
    expect(s.sponsorDeals).toHaveLength(1);          // deal stands
    expect(s.clubs[CLUB_ID].budget).toBe(1_000_000); // budget untouched
  });
});

describe('sponsorSlice — processSponsorSeasonEnd', () => {
  function baseState(table: LeagueTableEntry[], deals: SponsorDeal[], budget = 5_000_000): GameState {
    return {
      season: 1, week: 46, playerClubId: CLUB_ID, playerDivision: 'eng',
      clubs: { [CLUB_ID]: mkClub(budget) }, sponsorDeals: deals,
      divisionTables: { eng: table }, divisionFixtures: { eng: [] },
      cup: { winner: null, ties: [] }, messages: [],
    } as unknown as GameState;
  }
  const winnerTable: LeagueTableEntry[] = [
    { clubId: CLUB_ID, won: 28, goalsFor: 90, goalsAgainst: 25, cleanSheets: 18 } as unknown as LeagueTableEntry,
  ];

  it('pays the performance bonus into the budget when the condition is met', () => {
    const out = processSponsorSeasonEnd(baseState(winnerTable, [mkDeal({ bonusCondition: 'win_league', performanceBonus: 5_000_000 })]));
    expect(out.clubs![CLUB_ID].budget).toBe(10_000_000); // 5M base + 5M bonus
    // bonusMet is reset to false on surviving deals so next season starts clean
    // (the budget increase above is the proof the bonus was actually paid).
    expect(out.sponsorDeals![0].bonusMet).toBe(false);
  });

  it('does not pay when the condition is unmet', () => {
    const midTable: LeagueTableEntry[] = [
      { clubId: 'other', won: 30 } as unknown as LeagueTableEntry,
      { clubId: CLUB_ID, won: 10, goalsFor: 40, goalsAgainst: 50, cleanSheets: 3 } as unknown as LeagueTableEntry,
    ];
    const out = processSponsorSeasonEnd(baseState(midTable, [mkDeal({ bonusCondition: 'win_league', performanceBonus: 5_000_000 })]));
    expect(out.clubs![CLUB_ID].budget).toBe(5_000_000); // unchanged
    expect(out.sponsorDeals![0].bonusMet).toBe(false);
  });

  it('expires a deal once its duration has elapsed', () => {
    // startSeason 1 + duration 1 <= nextSeason (2) → expired.
    const out = processSponsorSeasonEnd(baseState(winnerTable, [mkDeal({ startSeason: 1, seasonDuration: 1 })]));
    expect(out.sponsorDeals).toHaveLength(0);
  });
});
