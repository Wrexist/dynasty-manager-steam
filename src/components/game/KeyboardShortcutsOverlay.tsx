import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Keyboard, X } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { GameScreen } from '@/types/game';
import { MAIN_TABS, WC_MAIN_TABS, UNEMPLOYED_MAIN_TABS, SCREEN_TITLES } from '@/config/navigation';
import { QUICK_NAV_KEYS } from '@/hooks/useDesktopNavShortcuts';
import { useCareerUnemployed } from '@/hooks/useGameSelectors';

// Desktop-only keyboard-shortcuts cheatsheet. Press "?" (Shift+/) to toggle.
// Mirrors the bindings implemented in useDesktopNavShortcuts so the help never
// claims a key the hook doesn't honour. Rendered only on the desktop (Steam)
// build by GameShell.

const TAB_LABEL: Partial<Record<GameScreen, string>> = {
  dashboard: 'Home', squad: 'Squad', tactics: 'Tactics', transfers: 'Market',
  'international-tournament': 'Tournament', 'job-market': 'Jobs', 'career-overview': 'Career', inbox: 'Inbox',
};

export function KeyboardShortcutsOverlay() {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const gameMode = useGameStore(s => s.gameMode);
  const isUnemployed = useCareerUnemployed();

  const tabs: GameScreen[] =
    gameMode === 'world-cup' ? WC_MAIN_TABS : isUnemployed ? UNEMPLOYED_MAIN_TABS : MAIN_TABS;

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      // "?" toggles the sheet. Ignore while typing so it never hijacks a field.
      if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && (e.key === '?' || (e.shiftKey && e.key === '/'))) {
        e.preventDefault();
        setOpen(o => !o);
        return;
      }
      // While open, Escape closes the sheet (and is swallowed so it doesn't also
      // trigger the nav-back shortcut underneath).
      if (open && e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    };
    // Capture phase so the Escape-to-close wins the race against the document
    // keydown listener in useDesktopNavShortcuts.
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open]);

  const isWorldCup = gameMode === 'world-cup';
  const rows: { keys: string[]; label: string }[] = [
    ...tabs.map((screen, i) => ({ keys: [String(i + 1)], label: TAB_LABEL[screen] ?? SCREEN_TITLES[screen] ?? screen })),
    ...(isWorldCup ? [] : QUICK_NAV_KEYS.map(q => ({ keys: [q.key], label: q.label }))),
    { keys: ['Esc'], label: 'Back' },
    { keys: ['?'], label: 'Toggle this help' },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-background/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.15 }}
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts"
        >
          <motion.div
            className="w-full max-w-sm rounded-2xl border border-border/60 bg-card/95 backdrop-blur-xl p-5 shadow-2xl"
            initial={{ scale: reduceMotion ? 1 : 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: reduceMotion ? 1 : 0.96, opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 32 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground">Keyboard Shortcuts</h2>
              </div>
              <button
                onClick={close}
                aria-label="Close"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ul className="flex flex-col gap-1.5">
              {rows.map(row => (
                <li key={row.label} className="flex items-center justify-between gap-3 py-1">
                  <span className="text-sm text-foreground/80">{row.label}</span>
                  <span className="flex items-center gap-1">
                    {row.keys.map(k => (
                      <kbd
                        key={k}
                        className="min-w-[1.6rem] px-1.5 h-6 inline-flex items-center justify-center rounded-md border border-border/70 bg-muted/50 text-[11px] font-semibold text-foreground/90 shadow-[inset_0_-1px_0_hsl(var(--border))]"
                      >
                        {k}
                      </kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[11px] text-muted-foreground text-center">
              Press <kbd className="px-1 rounded bg-muted/50 border border-border/60">?</kbd> anytime to toggle
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
