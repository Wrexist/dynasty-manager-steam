import { useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { MAIN_TABS, WC_MAIN_TABS, UNEMPLOYED_MAIN_TABS, DETAIL_SCREENS, BACK_TARGET } from '@/config/navigation';
import { useMatchLocked, useCareerUnemployed } from '@/hooks/useGameSelectors';
import { isDesktop } from '@/platform/desktop';
import type { GameScreen } from '@/types/game';

/** True when the keystroke should be ignored because the user is typing into a
 *  field, or a modal/dialog is open (number keys must not switch tabs behind a
 *  dialog or while editing a manager name / transfer search). */
function shouldIgnoreShortcut(e: KeyboardEvent): boolean {
  if (e.metaKey || e.ctrlKey || e.altKey) return true; // leave OS/browser combos alone
  const el = e.target as HTMLElement | null;
  if (el) {
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) return true;
  }
  // Any open Radix/role dialog → don't navigate underneath it.
  if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return true;
  return false;
}

/**
 * Desktop-only keyboard navigation. No-op on mobile/web, while a match is
 * locked, when a field is focused, or when a dialog is open.
 *
 *  • Number keys 1..N jump to the Nth main navigation tab (the same set the
 *    DesktopNav renders, respecting world-cup / unemployed career states).
 *  • Escape steps back from a detail screen to its parent — the same target
 *    the TopBar's back button uses — so the keyboard mirrors the visible
 *    navigation. On a main tab (no parent) Escape is left for Radix/dialogs.
 *
 * Mounted once from GameShell. Reuses the navigation config so it never drifts
 * from the visible nav.
 */
export function useDesktopNavShortcuts(): void {
  const setScreen = useGameStore(s => s.setScreen);
  const gameMode = useGameStore(s => s.gameMode);
  const matchLocked = useMatchLocked();
  const isUnemployed = useCareerUnemployed();

  useEffect(() => {
    if (!isDesktop()) return;

    const tabs: GameScreen[] =
      gameMode === 'world-cup' ? WC_MAIN_TABS
        : isUnemployed ? UNEMPLOYED_MAIN_TABS
          : MAIN_TABS;

    const handler = (e: KeyboardEvent) => {
      if (matchLocked) return;
      if (shouldIgnoreShortcut(e)) return;

      // Escape → back. Only on detail screens (those with a parent); on a main
      // tab there's nowhere to go, so leave Escape to close any popovers.
      if (e.key === 'Escape') {
        const { currentScreen, previousScreen } = useGameStore.getState();
        const isMainTab = tabs.includes(currentScreen) || !DETAIL_SCREENS.includes(currentScreen);
        if (isMainTab) return;
        const rawBack = BACK_TARGET[currentScreen] || previousScreen || 'dashboard';
        const back = isUnemployed && (rawBack === 'dashboard' || rawBack === 'squad') ? 'job-market' : rawBack;
        e.preventDefault();
        setScreen(back);
        return;
      }

      if (e.key < '1' || e.key > '9') return;
      const idx = Number(e.key) - 1;
      if (idx < 0 || idx >= tabs.length) return;
      e.preventDefault();
      setScreen(tabs[idx]);
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [setScreen, gameMode, matchLocked, isUnemployed]);
}
