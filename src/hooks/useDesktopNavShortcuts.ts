import { useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { MAIN_TABS, WC_MAIN_TABS, UNEMPLOYED_MAIN_TABS } from '@/config/navigation';
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
 * Desktop-only keyboard navigation: number keys 1..N jump to the Nth main
 * navigation tab (the same set the DesktopNav renders, respecting world-cup /
 * unemployed career states). No-op on mobile/web, while a match is locked, when
 * a field is focused, or when a dialog is open.
 *
 * Mounted once from GameShell. Reuses the MAIN_TABS config so it never drifts
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
      if (e.key < '1' || e.key > '9') return;
      if (shouldIgnoreShortcut(e)) return;
      const idx = Number(e.key) - 1;
      if (idx < 0 || idx >= tabs.length) return;
      e.preventDefault();
      setScreen(tabs[idx]);
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [setScreen, gameMode, matchLocked, isUnemployed]);
}
