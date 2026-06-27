import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const h = vi.hoisted(() => ({ desktop: true }));
vi.mock('@/platform/desktop', () => ({
  isDesktop: () => h.desktop,
  getElectronAPI: () => undefined,
}));

import { useDesktopNavShortcuts } from '@/hooks/useDesktopNavShortcuts';
import { useGameStore } from '@/store/gameStore';

function press(key: string, init: Partial<KeyboardEventInit> = {}) {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
  });
}

describe('useDesktopNavShortcuts', () => {
  beforeEach(() => {
    h.desktop = true;
    act(() => {
      useGameStore.setState({
        gameMode: 'sandbox',
        matchPhase: 'none',
        currentScreen: 'dashboard',
      } as Partial<ReturnType<typeof useGameStore.getState>>);
    });
  });
  afterEach(() => { document.body.innerHTML = ''; });

  it('maps number keys to the main nav tabs', () => {
    renderHook(() => useDesktopNavShortcuts());
    press('2');
    expect(useGameStore.getState().currentScreen).toBe('squad');
    press('3');
    expect(useGameStore.getState().currentScreen).toBe('tactics');
    press('1');
    expect(useGameStore.getState().currentScreen).toBe('dashboard');
  });

  it('ignores numbers past the tab count', () => {
    renderHook(() => useDesktopNavShortcuts());
    press('9');
    expect(useGameStore.getState().currentScreen).toBe('dashboard');
  });

  it('does nothing while typing in an input', () => {
    renderHook(() => useDesktopNavShortcuts());
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true, cancelable: true }));
    });
    expect(useGameStore.getState().currentScreen).toBe('dashboard');
  });

  it('leaves modifier combos (e.g. Cmd/Ctrl+2) to the OS/browser', () => {
    renderHook(() => useDesktopNavShortcuts());
    press('2', { metaKey: true });
    expect(useGameStore.getState().currentScreen).toBe('dashboard');
  });

  it('does not navigate while a dialog is open', () => {
    renderHook(() => useDesktopNavShortcuts());
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    document.body.appendChild(dialog);
    press('2');
    expect(useGameStore.getState().currentScreen).toBe('dashboard');
  });

  it('is inert on the mobile/web build', () => {
    h.desktop = false;
    renderHook(() => useDesktopNavShortcuts());
    press('2');
    expect(useGameStore.getState().currentScreen).toBe('dashboard');
  });

  it('Escape steps back from a detail screen to its parent', () => {
    act(() => { useGameStore.setState({ currentScreen: 'finance' } as Partial<ReturnType<typeof useGameStore.getState>>); });
    renderHook(() => useDesktopNavShortcuts());
    press('Escape');
    expect(useGameStore.getState().currentScreen).toBe('dashboard');
  });

  it('Escape is a no-op on a main tab (left for dialogs/popovers)', () => {
    renderHook(() => useDesktopNavShortcuts()); // currentScreen = dashboard (a main tab)
    press('Escape');
    expect(useGameStore.getState().currentScreen).toBe('dashboard');
  });

  it('Escape does not navigate while a dialog is open', () => {
    act(() => { useGameStore.setState({ currentScreen: 'finance' } as Partial<ReturnType<typeof useGameStore.getState>>); });
    renderHook(() => useDesktopNavShortcuts());
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    document.body.appendChild(dialog);
    press('Escape');
    expect(useGameStore.getState().currentScreen).toBe('finance');
  });
});
