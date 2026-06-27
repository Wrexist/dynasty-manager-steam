import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Control framer's OS-level prefers-reduced-motion independently of the store.
const h = vi.hoisted(() => ({ os: false }));
vi.mock('framer-motion', () => ({ useReducedMotion: () => h.os }));

import { useReducedMotionPref } from '@/hooks/useReducedMotionPref';
import { useGameStore } from '@/store/gameStore';

function setSettings(partial: Partial<{ reducedMotion: boolean; performanceMode: boolean }>) {
  act(() => {
    const s = useGameStore.getState();
    useGameStore.setState({ settings: { ...s.settings, ...partial } } as Partial<ReturnType<typeof useGameStore.getState>>);
  });
}

describe('useReducedMotionPref', () => {
  beforeEach(() => {
    h.os = false;
    setSettings({ reducedMotion: false, performanceMode: false });
  });
  afterEach(() => vi.restoreAllMocks());

  it('is false when no signal asks for reduced motion', () => {
    const { result } = renderHook(() => useReducedMotionPref());
    expect(result.current).toBe(false);
  });

  it('is true when the OS prefers reduced motion', () => {
    h.os = true;
    const { result } = renderHook(() => useReducedMotionPref());
    expect(result.current).toBe(true);
  });

  it('is true when the in-game Reduced Motion toggle is on', () => {
    setSettings({ reducedMotion: true });
    const { result } = renderHook(() => useReducedMotionPref());
    expect(result.current).toBe(true);
  });

  it('is true when Performance Mode is on', () => {
    setSettings({ performanceMode: true });
    const { result } = renderHook(() => useReducedMotionPref());
    expect(result.current).toBe(true);
  });
});
