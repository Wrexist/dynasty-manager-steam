/**
 * Player economics — value/wage/rarity pricing model.
 *
 * This is the single source of truth for transfer-market and wage figures
 * (recomputeDerivedEconomics is called from generation, development, training,
 * transfers, packs, and award lifecycles), so a regression here silently
 * corrupts the whole economy. calculatePlayerValue/Wage apply a ±15% random
 * factor, so value/wage tests pin Math.random to make relationships exact.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  getValueAgeMultiplier,
  getBallonDorPlacementPremium,
  recomputeDerivedEconomics,
  recomputePlayerValueOnly,
} from '@/utils/playerEconomics';
import type { Player, BallonDOrPlacement } from '@/types/game';

function mkPlayer(overrides: Partial<Player> = {}): Player {
  return {
    overall: 75,
    age: 26,
    ballonDOrPlacements: undefined,
    value: 0,
    wage: 0,
    rarity: undefined,
    ...overrides,
  } as Player;
}

afterEach(() => vi.restoreAllMocks());

describe('getValueAgeMultiplier', () => {
  it('peaks in the 24–28 prime band and decays toward the veteran tail', () => {
    expect(getValueAgeMultiplier(26)).toBe(1.0);   // prime
    expect(getValueAgeMultiplier(17)).toBe(0.35);  // teen prospect
    expect(getValueAgeMultiplier(20)).toBe(0.58);
    expect(getValueAgeMultiplier(33)).toBe(0.28);  // veteran
    expect(getValueAgeMultiplier(40)).toBe(0.10);  // end of career (Infinity tier)
  });

  it('uses inclusive upper bounds (age == maxAge resolves to that tier)', () => {
    expect(getValueAgeMultiplier(18)).toBe(0.35);
    expect(getValueAgeMultiplier(19)).toBe(0.58);
    expect(getValueAgeMultiplier(28)).toBe(1.0);
    expect(getValueAgeMultiplier(29)).toBe(0.82);
  });
});

describe('getBallonDorPlacementPremium', () => {
  it('is 1.0 with no placements', () => {
    expect(getBallonDorPlacementPremium(undefined)).toBe(1.0);
    expect(getBallonDorPlacementPremium([])).toBe(1.0);
  });

  it('a win (rank 1) lifts the premium above 1.0', () => {
    expect(getBallonDorPlacementPremium([{ rank: 1, season: 1 } as BallonDOrPlacement])).toBeGreaterThan(1.0);
  });

  it('multiple placements compound (more than a single one)', () => {
    const single = getBallonDorPlacementPremium([{ rank: 1, season: 1 } as BallonDOrPlacement]);
    const double = getBallonDorPlacementPremium([
      { rank: 1, season: 1 } as BallonDOrPlacement,
      { rank: 1, season: 2 } as BallonDOrPlacement,
    ]);
    expect(double).toBeGreaterThan(single);
  });

  it('placements outside the top-N add no boost', () => {
    // A rank far below the award threshold contributes a 0 boost → factor 1.0.
    expect(getBallonDorPlacementPremium([{ rank: 999, season: 1 } as BallonDOrPlacement])).toBe(1.0);
  });
});

describe('recomputeDerivedEconomics', () => {
  it('sets a positive value, wage, and rarity from overall', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const p = mkPlayer({ overall: 80, age: 26 });
    recomputeDerivedEconomics(p);
    expect(p.value).toBeGreaterThan(0);
    expect(p.wage).toBeGreaterThan(0);
    expect(p.rarity).toBeDefined();
  });

  it('values a prime player above an identical veteran (age multiplier)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const prime = mkPlayer({ overall: 80, age: 26 });
    const veteran = mkPlayer({ overall: 80, age: 33 });
    recomputeDerivedEconomics(prime);
    recomputeDerivedEconomics(veteran);
    expect(prime.value).toBeGreaterThan(veteran.value);
  });

  it('values a higher-rated player above a lower-rated one at the same age', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const better = mkPlayer({ overall: 88, age: 26 });
    const worse = mkPlayer({ overall: 68, age: 26 });
    recomputeDerivedEconomics(better);
    recomputeDerivedEconomics(worse);
    expect(better.value).toBeGreaterThan(worse.value);
    expect(better.wage).toBeGreaterThan(worse.wage);
  });

  it('Ballon d\'Or placements raise value vs an otherwise identical player', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const plain = mkPlayer({ overall: 90, age: 27 });
    const decorated = mkPlayer({ overall: 90, age: 27, ballonDOrPlacements: [{ rank: 1, season: 1 } as BallonDOrPlacement] });
    recomputeDerivedEconomics(plain);
    recomputeDerivedEconomics(decorated);
    expect(decorated.value).toBeGreaterThan(plain.value);
  });
});

describe('recomputePlayerValueOnly', () => {
  it('updates value and rarity but leaves wage untouched', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const p = mkPlayer({ overall: 80, age: 26, wage: 123456 });
    recomputePlayerValueOnly(p);
    expect(p.value).toBeGreaterThan(0);
    expect(p.rarity).toBeDefined();
    expect(p.wage).toBe(123456); // wage deliberately preserved
  });
});
