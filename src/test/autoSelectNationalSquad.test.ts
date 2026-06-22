/**
 * autoSelectNationalSquad — the AI 23-man national-team picker.
 *
 * nationalTeamFlow.test.ts covers the slice flow (squad 11-23, lineup, subs) but
 * not this picker's own correctness guarantees. If it ever selected an injured
 * player, a duplicate, or skipped position coverage, the national team would
 * field an invalid squad. These tests pin those invariants directly.
 */
import { describe, it, expect } from 'vitest';
import { autoSelectNationalSquad, resolveNationalityAliases } from '@/utils/international';
import { NATIONAL_SQUAD_SIZE, LOW_FITNESS_THRESHOLD } from '@/config/gameBalance';
import type { Player, Position } from '@/types/game';

let idc = 0;
function mk(overrides: Partial<Player>): Player {
  idc++;
  return {
    id: `p${idc}`, firstName: 'F', lastName: `L${idc}`,
    nationality: 'England', position: 'CM' as Position, overall: 75, age: 25,
    injured: false, fitness: 100, suspendedUntilWeek: undefined,
    ...overrides,
  } as Player;
}

function rosterOf(...players: Player[]): Record<string, Player> {
  const rec: Record<string, Player> = {};
  for (const p of players) rec[p.id] = p;
  return rec;
}

/** A deep, well-balanced England pool (32 eligible across all groups). */
function deepEnglandPool(extra: Player[] = []): Record<string, Player> {
  const players: Player[] = [];
  const add = (pos: Position, n: number) => { for (let i = 0; i < n; i++) players.push(mk({ position: pos })); };
  add('GK', 4); add('CB', 6); add('LB', 2); add('RB', 2);
  add('CDM', 3); add('CM', 5); add('CAM', 2); add('LW', 2); add('RW', 2); add('ST', 4);
  return rosterOf(...players, ...extra);
}

const DEF = new Set<Position>(['CB', 'LB', 'RB']);
const MID = new Set<Position>(['CDM', 'CM', 'CAM', 'LM', 'RM']);
const FWD = new Set<Position>(['LW', 'RW', 'ST']);

describe('autoSelectNationalSquad', () => {
  it('never exceeds the squad size and has no duplicates', () => {
    const squad = autoSelectNationalSquad('England', deepEnglandPool());
    expect(squad.length).toBeLessThanOrEqual(NATIONAL_SQUAD_SIZE);
    expect(new Set(squad).size).toBe(squad.length);
  });

  it('meets position-coverage minimums (2 GK, 5 DEF, 4 MID, 2 FWD)', () => {
    const pool = deepEnglandPool();
    const squad = autoSelectNationalSquad('England', pool).map(id => pool[id]);
    expect(squad.filter(p => p.position === 'GK').length).toBeGreaterThanOrEqual(2);
    expect(squad.filter(p => DEF.has(p.position)).length).toBeGreaterThanOrEqual(5);
    expect(squad.filter(p => MID.has(p.position)).length).toBeGreaterThanOrEqual(4);
    expect(squad.filter(p => FWD.has(p.position)).length).toBeGreaterThanOrEqual(2);
  });

  it('excludes injured players even when they are the highest-rated', () => {
    const star = mk({ position: 'ST', overall: 99, injured: true });
    const pool = deepEnglandPool([star]);
    expect(autoSelectNationalSquad('England', pool)).not.toContain(star.id);
  });

  it('excludes players suspended past the current week, but includes expired suspensions', () => {
    const suspended = mk({ position: 'ST', overall: 99, suspendedUntilWeek: 12 });
    const expired = mk({ position: 'ST', overall: 98, suspendedUntilWeek: 8 });
    const pool = deepEnglandPool([suspended, expired]);
    const squad = autoSelectNationalSquad('England', pool, 10);
    expect(squad).not.toContain(suspended.id);
    expect(squad).toContain(expired.id);
  });

  it('excludes exhausted (low-fitness) players', () => {
    const tired = mk({ position: 'ST', overall: 99, fitness: LOW_FITNESS_THRESHOLD - 1 });
    const pool = deepEnglandPool([tired]);
    expect(autoSelectNationalSquad('England', pool)).not.toContain(tired.id);
  });

  it('excludes under-17 players', () => {
    const kid = mk({ position: 'ST', overall: 99, age: 16 });
    const pool = deepEnglandPool([kid]);
    expect(autoSelectNationalSquad('England', pool)).not.toContain(kid.id);
  });

  it('only selects players of the requested nationality', () => {
    const frenchStar = mk({ position: 'ST', overall: 99, nationality: 'France' });
    const pool = deepEnglandPool([frenchStar]);
    expect(autoSelectNationalSquad('England', pool)).not.toContain(frenchStar.id);
  });

  it('includes players whose nationality is an alias of the requested nation', () => {
    // Netherlands ⇄ Holland (see NATIONALITY_ALIASES).
    expect(resolveNationalityAliases('Netherlands')).toContain('Holland');
    const dutch = Array.from({ length: 15 }, (_, i) =>
      mk({ position: (['GK', 'CB', 'CM', 'ST'] as Position[])[i % 4], nationality: 'Holland' }));
    const squad = autoSelectNationalSquad('Netherlands', rosterOf(...dutch));
    expect(squad.length).toBeGreaterThan(0);
    expect(dutch.some(p => squad.includes(p.id))).toBe(true);
  });

  it('prioritises the best available players', () => {
    const worldClass = mk({ position: 'CM', overall: 99 });
    const pool = deepEnglandPool([worldClass]);
    expect(autoSelectNationalSquad('England', pool)).toContain(worldClass.id);
  });
});
