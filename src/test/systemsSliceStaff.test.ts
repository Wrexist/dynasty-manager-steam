/**
 * systemsSlice — staff money actions (hireStaff / fireStaff / praiseStaff).
 * systemsSlice.test covers tactics presets, training, and scouting; this guards
 * the budget-touching staff path: hiring deducts a fee and is refused when
 * unaffordable, one-per-role auto-release, firing removes the member, and the
 * praise interaction cooldown.
 */
import { describe, it, expect } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { STAFF_HIRING_FEE_WEEKS } from '@/config/staff';
import type { GameState } from '@/store/storeTypes';
import type { Club, StaffMember, StaffRole } from '@/types/game';

const CLUB = 'club-x';

function staff(id: string, role: StaffRole, over: Partial<StaffMember> = {}): StaffMember {
  return { id, firstName: 'S', lastName: id, role, quality: 70, wage: 10_000, morale: 70, ...over } as unknown as StaffMember;
}
function club(budget: number): Club {
  return { id: CLUB, name: CLUB, shortName: CLUB, budget, wageBill: 0, playerIds: [], lineup: [], subs: [] } as unknown as Club;
}
function seed(over: Partial<GameState> = {}) {
  useGameStore.setState({
    season: 1, week: 5, playerClubId: CLUB, clubs: { [CLUB]: club(1_000_000) },
    staff: { members: [], availableHires: [] } as GameState['staff'],
    scouting: { maxAssignments: 1, assignments: [], reports: [], discoveredPlayers: [] } as GameState['scouting'],
    messages: [], ...over,
  } as Partial<GameState> as never);
}
const staffState = () => useGameStore.getState().staff;
const budget = () => useGameStore.getState().clubs[CLUB].budget;

describe('systemsSlice — hireStaff', () => {
  it('hires from the available pool and deducts the hiring fee', () => {
    const hire = staff('h1', 'scout' as StaffRole, { wage: 10_000 });
    seed({ staff: { members: [], availableHires: [hire] } as GameState['staff'] });
    useGameStore.getState().hireStaff('h1');
    expect(staffState().members.map(m => m.id)).toContain('h1');
    expect(staffState().availableHires).toHaveLength(0);
    expect(budget()).toBe(1_000_000 - 10_000 * STAFF_HIRING_FEE_WEEKS);
  });

  it('refuses to hire when the club cannot afford the fee (no change)', () => {
    const hire = staff('h1', 'scout' as StaffRole, { wage: 10_000 });
    seed({ clubs: { [CLUB]: club(10_000) }, staff: { members: [], availableHires: [hire] } as GameState['staff'] });
    useGameStore.getState().hireStaff('h1'); // fee 40k > 10k budget
    expect(staffState().members).toHaveLength(0);
    expect(budget()).toBe(10_000);
  });

  it('auto-releases the existing holder of the same role', () => {
    const existing = staff('old', 'physio' as StaffRole);
    const hire = staff('new', 'physio' as StaffRole);
    seed({ staff: { members: [existing], availableHires: [hire] } as GameState['staff'] });
    useGameStore.getState().hireStaff('new');
    const ids = staffState().members.map(m => m.id);
    expect(ids).toContain('new');
    expect(ids).not.toContain('old'); // replaced — one per role
  });
});

describe('systemsSlice — fireStaff', () => {
  it('removes the member from the staff', () => {
    seed({ staff: { members: [staff('s1', 'scout' as StaffRole)], availableHires: [] } as GameState['staff'] });
    useGameStore.getState().fireStaff('s1');
    expect(staffState().members).toHaveLength(0);
  });

  it('is a no-op for an unknown staff id', () => {
    seed({ staff: { members: [staff('s1', 'scout' as StaffRole)], availableHires: [] } as GameState['staff'] });
    useGameStore.getState().fireStaff('ghost');
    expect(staffState().members).toHaveLength(1);
  });
});

describe('systemsSlice — praiseStaff', () => {
  it('boosts a member who has not been interacted with recently', () => {
    const m = staff('s1', 'scout' as StaffRole, { morale: 50 });
    seed({ staff: { members: [m], availableHires: [] } as GameState['staff'] });
    const res = useGameStore.getState().praiseStaff('s1');
    expect(res.success).toBe(true);
    expect((staffState().members[0].morale ?? 0)).toBeGreaterThan(50);
  });

  it('rejects when the interaction cooldown is active', () => {
    // A far-future last-interaction makes weeksSince negative → within cooldown.
    const m = staff('s1', 'scout' as StaffRole, { lastInteractionWeek: 9_999_999 } as Partial<StaffMember>);
    seed({ staff: { members: [m], availableHires: [] } as GameState['staff'] });
    const res = useGameStore.getState().praiseStaff('s1');
    expect(res.success).toBe(false);
  });
});
