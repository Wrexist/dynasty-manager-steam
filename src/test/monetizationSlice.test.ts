/**
 * monetizationSlice — entitlement WRITE path (grant/restore/trial/cosmetic).
 *
 * monetization.test.ts covers the read-side checks (isPro, hasProduct, …). These
 * regressions guard the revenue-critical mutations and the invariants from
 * CLAUDE.md: subscription + consumable SKUs must never be persisted as
 * entitlements, bundles expand to their includes, the free trial can't be
 * restarted, and cosmetics require pack ownership.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import type { GameState } from '@/store/storeTypes';
import type { MonetizationState } from '@/types/game';

const BUNDLE = 'com.dynastymanager.bundle.all';
const PRO = 'com.dynastymanager.pro';
const MANAGER_PACK = 'com.dynastymanager.pack.manager';
const SUB_MONTHLY = 'com.dynastymanager.pro.monthly';
const CONSUMABLE_GOLD = 'com.dynastymanager.pack.gold';

function freshMonetization(over: Partial<MonetizationState> = {}): MonetizationState {
  return {
    entitlements: [], activeCosmetics: {}, adRewardsClaimed: {},
    subscription: null, starterKitDismissed: false, firstLaunchTimestamp: 0,
    ...over,
  } as MonetizationState;
}
const mon = () => useGameStore.getState().monetization;

describe('monetizationSlice — entitlements', () => {
  beforeEach(() => {
    useGameStore.setState({ monetization: freshMonetization(), season: 1 } as Partial<GameState> as never);
  });

  it('grantEntitlement expands a bundle into its included products', () => {
    useGameStore.getState().grantEntitlement(BUNDLE as never);
    expect(mon().entitlements).toContain(BUNDLE);
    expect(mon().entitlements).toContain(PRO);
    expect(mon().entitlements).toContain(MANAGER_PACK);
  });

  it('grantEntitlement never persists a subscription SKU', () => {
    useGameStore.getState().grantEntitlement(SUB_MONTHLY as never);
    expect(mon().entitlements).not.toContain(SUB_MONTHLY);
  });

  it('grantEntitlement never persists a consumable pack SKU', () => {
    useGameStore.getState().grantEntitlement(CONSUMABLE_GOLD as never);
    expect(mon().entitlements).not.toContain(CONSUMABLE_GOLD);
  });

  it('grantEntitlement does not duplicate an already-owned product', () => {
    useGameStore.getState().grantEntitlement(PRO as never);
    useGameStore.getState().grantEntitlement(PRO as never);
    expect(mon().entitlements.filter(e => e === PRO)).toHaveLength(1);
  });

  it('restoreEntitlements filters subs/consumables and expands bundles', () => {
    useGameStore.getState().restoreEntitlements([BUNDLE, SUB_MONTHLY, CONSUMABLE_GOLD] as never);
    const e = mon().entitlements;
    expect(e).toContain(PRO);          // from bundle expansion
    expect(e).toContain(MANAGER_PACK); // from bundle expansion
    expect(e).not.toContain(SUB_MONTHLY);
    expect(e).not.toContain(CONSUMABLE_GOLD);
  });
});

describe('monetizationSlice — free trial', () => {
  beforeEach(() => {
    useGameStore.setState({ monetization: freshMonetization() } as Partial<GameState> as never);
  });

  it('startFreeTrial enrols a trial subscription', () => {
    useGameStore.getState().startFreeTrial();
    expect(mon().subscription?.tier).toBe('trial');
    expect(mon().subscription?.isTrial).toBe(true);
  });

  it('startFreeTrial is a no-op when ANY subscription already exists (anti-abuse)', () => {
    useGameStore.setState({
      monetization: freshMonetization({ subscription: { tier: 'monthly', productId: SUB_MONTHLY, expiresAt: new Date(Date.now() + 1e9).toISOString(), willRenew: true, isInGracePeriod: false, isTrial: false } as MonetizationState['subscription'] }),
    } as Partial<GameState> as never);
    useGameStore.getState().startFreeTrial();
    expect(mon().subscription?.tier).toBe('monthly'); // unchanged — no trial restart
  });
});

describe('monetizationSlice — cosmetics & ad rewards', () => {
  beforeEach(() => {
    useGameStore.setState({ monetization: freshMonetization(), season: 1 } as Partial<GameState> as never);
  });

  it('setCosmetic is a no-op when the player does not own the pack', () => {
    useGameStore.getState().setCosmetic('avatar' as never, 'avatar-classic');
    expect(mon().activeCosmetics.avatar).toBeUndefined();
  });

  it('setCosmetic applies when the pack is owned', () => {
    useGameStore.setState({ monetization: freshMonetization({ entitlements: [MANAGER_PACK] }) } as Partial<GameState> as never);
    useGameStore.getState().setCosmetic('avatar' as never, 'avatar-classic');
    expect(mon().activeCosmetics.avatar).toBe('avatar-classic');
  });

  it('claimAdReward enforces the per-season limit', () => {
    // season_bonus has a limit of 1.
    expect(useGameStore.getState().claimAdReward('season_bonus' as never)).toBe(true);
    expect(useGameStore.getState().claimAdReward('season_bonus' as never)).toBe(false);
  });

  it('claimAdReward resets across seasons', () => {
    expect(useGameStore.getState().claimAdReward('season_bonus' as never)).toBe(true);
    useGameStore.setState({ season: 2 } as Partial<GameState> as never);
    expect(useGameStore.getState().claimAdReward('season_bonus' as never)).toBe(true);
  });
});
