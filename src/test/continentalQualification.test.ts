/**
 * Continental qualification + draw — getChampions/Shield/ConferenceCupQualifiers
 * and generateContinentalDraw.
 *
 * The agent audit flagged the qualifier path as a soft-lock risk (an empty or
 * short field stranding the next season's tournament). Investigation showed the
 * Champions field fills to exactly 32, while Shield/Conference can come up 1–2
 * short (their per-league spot allocations sum below 32) — but generateContinental
 * Draw pads any field to a full 8×4 structure, so there is NO soft-lock. These
 * tests pin those real invariants: disjoint fields + a always-valid 32-team draw.
 */
import { describe, it, expect } from 'vitest';
import {
  getChampionsCupQualifiers,
  getShieldCupQualifiers,
  getConferenceCupQualifiers,
  generateContinentalDraw,
} from '@/data/continentalDraw';
import { CONTINENTAL_TOTAL_TEAMS, CONTINENTAL_GROUPS, CONTINENTAL_TEAMS_PER_GROUP } from '@/config/continental';
import type { LeagueTableEntry } from '@/types/game';

const PLAYER_LEAGUE = 'eng'; // Premier League — a real top-tier league id

function mkTable(n: number): LeagueTableEntry[] {
  return Array.from({ length: n }, (_, i) => ({
    clubId: `eng-c${i + 1}`,
    played: 38, won: 38 - i, drawn: 0, lost: i,
    goalsFor: 80, goalsAgainst: 30, goalDifference: 50,
    points: 100 - i * 3, form: [],
  })) as LeagueTableEntry[];
}

function mkClubs(n: number): Record<string, { name: string; shortName: string; color: string; reputation: number }> {
  const clubs: Record<string, { name: string; shortName: string; color: string; reputation: number }> = {};
  for (let i = 1; i <= n; i++) {
    clubs[`eng-c${i}`] = { name: `Club ${i}`, shortName: `C${i}`, color: '#ffffff', reputation: 80 - i };
  }
  return clubs;
}

describe('continental qualification — fields', () => {
  it('fills a complete 32-team Champions Cup field with no duplicates', () => {
    const { qualifiers } = getChampionsCupQualifiers(PLAYER_LEAGUE, mkTable(20), mkClubs(20));
    expect(qualifiers.length).toBe(CONTINENTAL_TOTAL_TEAMS);
    expect(new Set(qualifiers).size).toBe(qualifiers.length);
  });

  it('produces disjoint Champions / Shield / Conference fields', () => {
    const table = mkTable(20);
    const clubs = mkClubs(20);
    const champions = getChampionsCupQualifiers(PLAYER_LEAGUE, table, clubs);
    const cl = new Set(champions.qualifiers);
    const shield = getShieldCupQualifiers(PLAYER_LEAGUE, table, clubs, cl);
    const sh = new Set(shield.qualifiers);
    const conference = getConferenceCupQualifiers(PLAYER_LEAGUE, table, clubs, cl, sh);
    const co = new Set(conference.qualifiers);

    for (const id of cl) {
      expect(sh.has(id), `${id} double-qualified CL+Shield`).toBe(false);
      expect(co.has(id), `${id} double-qualified CL+Conference`).toBe(false);
    }
    for (const id of sh) {
      expect(co.has(id), `${id} double-qualified Shield+Conference`).toBe(false);
    }
    // All three fields now backfill to a full 32 with REAL clubs (no
    // placeholder padding), with no duplicates.
    for (const q of [champions, shield, conference]) {
      expect(q.qualifiers.length).toBe(CONTINENTAL_TOTAL_TEAMS);
      expect(new Set(q.qualifiers).size).toBe(q.qualifiers.length);
      expect(q.qualifiers.some(id => id.startsWith('placeholder-'))).toBe(false);
    }
  });

  it('guarantees the Shield Cup winner a Champions Cup spot even if low-ranked', () => {
    const table = mkTable(20);
    const clubs = mkClubs(20);
    const winnerId = 'eng-c20'; // bottom of the table — would not otherwise reach the CL
    const { qualifiers } = getChampionsCupQualifiers(PLAYER_LEAGUE, table, clubs, undefined, winnerId);
    expect(qualifiers).toContain(winnerId);
  });
});

describe('continental qualification — draw (soft-lock guard)', () => {
  it('always builds a valid 8-group / 32-team draw from a normal field', () => {
    const { qualifiers, virtualClubs } = getChampionsCupQualifiers(PLAYER_LEAGUE, mkTable(20), mkClubs(20));
    const draw = generateContinentalDraw('champions_cup', 2, qualifiers, virtualClubs, 'eng-c1');
    expect(draw.groups.length).toBe(CONTINENTAL_GROUPS);
    const allClubs = draw.groups.flatMap(g => g.clubIds);
    expect(allClubs.length).toBe(CONTINENTAL_TOTAL_TEAMS);
    expect(new Set(allClubs).size).toBe(CONTINENTAL_TOTAL_TEAMS); // unique
    for (const g of draw.groups) expect(g.clubIds.length).toBe(CONTINENTAL_TEAMS_PER_GROUP);
  });

  it('pads an EMPTY qualifier list to a full draw instead of soft-locking', () => {
    // The dangerous case the audit feared: zero qualifiers. The draw must still
    // produce a complete, playable 8×4 structure (via placeholder clubs).
    const draw = generateContinentalDraw('shield_cup', 2, [], {}, 'nobody');
    expect(draw.groups.length).toBe(CONTINENTAL_GROUPS);
    const allClubs = draw.groups.flatMap(g => g.clubIds);
    expect(allClubs.length).toBe(CONTINENTAL_TOTAL_TEAMS);
    expect(new Set(allClubs).size).toBe(CONTINENTAL_TOTAL_TEAMS);
  });
});
