import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { DesktopNav } from '@/components/game/DesktopNav';
import { useGameStore } from '@/store/gameStore';
import { MAIN_TABS } from '@/config/navigation';

vi.mock('@/utils/haptics', () => ({
  hapticLight: vi.fn(), hapticMedium: vi.fn(), hapticHeavy: vi.fn(),
  hapticSuccess: vi.fn(), hapticError: vi.fn(), hapticWarning: vi.fn(),
}));

describe('DesktopNav — keyboard discoverability & a11y', () => {
  beforeEach(() => {
    act(() => {
      useGameStore.setState({
        gameMode: 'sandbox',
        matchPhase: 'none',
        currentScreen: 'dashboard',
        messages: [],
        incomingOffers: [],
        jobOffers: [],
      } as Partial<ReturnType<typeof useGameStore.getState>>);
    });
  });

  it('annotates the main tabs with their number-key shortcut (1..N), matching MAIN_TABS order', () => {
    render(<DesktopNav />);
    // Each main tab exposes aria-keyshortcuts = its 1-based index, which is the
    // contract useDesktopNavShortcuts relies on.
    for (let i = 0; i < MAIN_TABS.length; i++) {
      const btns = screen.getAllByRole('button').filter(
        b => b.getAttribute('aria-keyshortcuts') === String(i + 1),
      );
      expect(btns.length, `a tab with shortcut ${i + 1}`).toBeGreaterThan(0);
    }
  });

  it('navigates when a main tab is clicked', () => {
    render(<DesktopNav />);
    const squadBtn = screen.getAllByRole('button').find(
      b => b.getAttribute('aria-keyshortcuts') === '2',
    )!;
    act(() => { fireEvent.click(squadBtn); });
    expect(useGameStore.getState().currentScreen).toBe('squad');
  });

  it('exposes a focus-visible ring class on nav buttons (visible keyboard focus)', () => {
    render(<DesktopNav />);
    const tab = screen.getAllByRole('button').find(
      b => b.getAttribute('aria-keyshortcuts') === '1',
    )!;
    expect(tab.className).toContain('focus-visible:ring-2');
  });
});
