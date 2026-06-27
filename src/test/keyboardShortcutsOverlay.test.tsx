import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { KeyboardShortcutsOverlay } from '@/components/game/KeyboardShortcutsOverlay';
import { useGameStore } from '@/store/gameStore';

vi.mock('@/utils/haptics', () => ({
  hapticLight: vi.fn(), hapticMedium: vi.fn(), hapticHeavy: vi.fn(),
  hapticSuccess: vi.fn(), hapticError: vi.fn(), hapticWarning: vi.fn(),
}));

// Strip framer-motion animation so open/close maps directly to mount/unmount
// (AnimatePresence's exit animation otherwise keeps the node alive in jsdom).
vi.mock('framer-motion', () => {
  const MOTION_PROPS = new Set(['initial', 'animate', 'exit', 'transition', 'layoutId', 'whileHover', 'whileTap']);
  const make = (tag: string) => ({ children, ...props }: Record<string, unknown>) => {
    const dom = Object.fromEntries(Object.entries(props).filter(([k]) => !MOTION_PROPS.has(k)));
    return React.createElement(tag, dom, children as React.ReactNode);
  };
  return {
    motion: new Proxy({}, { get: (_t, tag: string) => make(tag) }),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    useReducedMotion: () => true,
  };
});

function press(key: string, init: Partial<KeyboardEventInit> = {}) {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
  });
}

describe('KeyboardShortcutsOverlay', () => {
  beforeEach(() => {
    act(() => {
      useGameStore.setState({ gameMode: 'sandbox', matchPhase: 'none' } as Partial<ReturnType<typeof useGameStore.getState>>);
    });
  });
  afterEach(() => { document.body.innerHTML = ''; });

  it('is hidden until "?" is pressed, then lists the main-tab shortcuts', () => {
    render(<KeyboardShortcutsOverlay />);
    expect(screen.queryByRole('dialog')).toBeNull();
    press('?');
    expect(screen.getByRole('dialog', { name: /keyboard shortcuts/i })).toBeTruthy();
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('Back')).toBeTruthy();
  });

  it('Escape closes the sheet', () => {
    render(<KeyboardShortcutsOverlay />);
    press('?');
    expect(screen.queryByRole('dialog')).toBeTruthy();
    press('Escape');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not toggle while typing in a field', () => {
    render(<KeyboardShortcutsOverlay />);
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true, cancelable: true }));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
