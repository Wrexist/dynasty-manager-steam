import { useMemo, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { GameScreen } from '@/types/game';
import {
  LayoutDashboard, Users, Target, ArrowLeftRight, Briefcase, User, Mail, Trophy,
  Table2, CalendarDays, Dumbbell, UserCog, GraduationCap, Search, Package, Keyboard,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { MoreDrawer } from './MoreDrawer';
import { SHORTCUTS_TOGGLE_EVENT } from './KeyboardShortcutsOverlay';
import { hapticLight } from '@/utils/haptics';
import { useMatchLocked, useCareerUnemployed } from '@/hooks/useGameSelectors';

// Desktop (Steam) navigation rail. Rendered only in the Electron build by
// GameShell, replacing the mobile bottom pill + SubNav. A left sidebar gives
// every section a stable home and lets contextual sub-tabs nest *under* their
// parent section — so the active group reads as "Market › Scouting" instead of
// the old top bar's confusing side-by-side "Market / Market". Mirrors the
// bottom nav's tab sets/badges so behaviour stays identical.

type Tab = { screen: GameScreen; label: string; icon: React.ElementType; group?: GameScreen[] };

const SQUAD_SCREENS: GameScreen[] = ['squad', 'staff', 'youth-academy', 'training'];
const MARKET_SCREENS: GameScreen[] = ['transfers', 'scouting', 'packs'];

const mainTabs: Tab[] = [
  { screen: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { screen: 'squad', label: 'Squad', icon: Users, group: SQUAD_SCREENS },
  { screen: 'tactics', label: 'Tactics', icon: Target },
  { screen: 'transfers', label: 'Market', icon: ArrowLeftRight, group: MARKET_SCREENS },
];

const unemployedTabs: Tab[] = [
  { screen: 'job-market', label: 'Jobs', icon: Briefcase },
  { screen: 'career-overview', label: 'Career', icon: User },
  { screen: 'inbox', label: 'Inbox', icon: Mail },
];

const worldCupTabs: Tab[] = [
  { screen: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { screen: 'squad', label: 'Squad', icon: Users },
  { screen: 'tactics', label: 'Tactics', icon: Target },
  { screen: 'international-tournament', label: 'Tournament', icon: Trophy },
];

// Contextual sub-tabs surfaced (indented) under their parent section when the
// active screen is inside that group. The parent row already navigates to (and
// highlights for) the group's lead screen — Squad / Market — so these list only
// the *sibling* screens, avoiding a redundant duplicate row under the parent.
const SUB_TABS: Partial<Record<GameScreen, Tab[]>> = {
  squad: [
    { screen: 'training', label: 'Training', icon: Dumbbell },
    { screen: 'staff', label: 'Staff', icon: UserCog },
    { screen: 'youth-academy', label: 'Youth', icon: GraduationCap },
  ],
  transfers: [
    { screen: 'scouting', label: 'Scouting', icon: Search },
    { screen: 'packs', label: 'Packs', icon: Package },
  ],
};

const quickLinks: Tab[] = [
  { screen: 'inbox', label: 'Inbox', icon: Mail },
  { screen: 'league-table', label: 'Table', icon: Table2 },
  { screen: 'calendar', label: 'Calendar', icon: CalendarDays },
];

export function DesktopNav() {
  const { currentScreen, messages, incomingOffers, jobOffers, gameMode } = useGameStore(useShallow(s => ({
    currentScreen: s.currentScreen, messages: s.messages, incomingOffers: s.incomingOffers,
    jobOffers: s.jobOffers, gameMode: s.gameMode,
  })));
  const setScreen = useGameStore(s => s.setScreen);
  const matchLocked = useMatchLocked();
  const isUnemployed = useCareerUnemployed();
  const reduceMotion = useReducedMotion();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const unreadCount = useMemo(() => messages.filter(m => !m.read).length, [messages]);
  const pendingOffers = incomingOffers.length;
  const hasJobOffers = gameMode === 'career' && jobOffers.length > 0;
  const isWorldCup = gameMode === 'world-cup';
  const activeTabs = isWorldCup ? worldCupTabs : isUnemployed ? unemployedTabs : mainTabs;

  const badgeFor = (screen: GameScreen): 'gold' | 'red' | null => {
    if ((screen === 'job-market' || screen === 'dashboard') && hasJobOffers) return 'gold';
    if (screen === 'dashboard' && unreadCount > 0) return 'red';
    if (screen === 'inbox' && unreadCount > 0) return 'red';
    if (screen === 'transfers' && pendingOffers > 0) return 'red';
    return null;
  };

  // `sectionActive` marks a mother tab whose *child* is the current screen (the
  // active screen is in its group but isn't the mother screen itself). Such a
  // mother reads as an expanded section header — a subtle tint, not a competing
  // solid pill — so the strong pill always lands on the single active leaf and
  // the parent→child relationship is unambiguous.
  const NavButton = ({ tab, layoutId, shortcut, nested, sectionActive }: { tab: Tab; layoutId: string; shortcut?: number; nested?: boolean; sectionActive?: boolean }) => {
    const exact = currentScreen === tab.screen;
    const Icon = tab.icon;
    const badge = badgeFor(tab.screen);
    return (
      <button
        type="button"
        onClick={() => { if (matchLocked) return; hapticLight(); setScreen(tab.screen); }}
        aria-current={exact ? 'page' : sectionActive ? 'true' : undefined}
        aria-disabled={matchLocked || undefined}
        // Desktop number-key shortcut (see useDesktopNavShortcuts): surface it on
        // hover + to assistive tech so the keyboard nav is discoverable.
        title={shortcut ? `${tab.label} (press ${shortcut})` : undefined}
        aria-keyshortcuts={shortcut ? String(shortcut) : undefined}
        className={cn(
          'relative flex items-center gap-3 w-full rounded-lg font-medium transition-colors text-left',
          'outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          nested ? 'h-9 px-3 text-[13px]' : 'h-10 px-3 text-sm',
          matchLocked ? 'opacity-50 cursor-not-allowed pointer-events-none'
            : exact ? 'text-primary-foreground'
            : sectionActive ? 'text-primary bg-primary/10 cursor-pointer'
            : 'text-foreground/70 hover:text-foreground hover:bg-foreground/[0.06] cursor-pointer',
        )}
      >
        {exact && (
          <motion.span
            layoutId={layoutId}
            initial={false}
            transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 38, mass: 0.8 }}
            className="absolute inset-0 rounded-lg bg-primary/90 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.2),0_2px_8px_hsl(var(--primary)/0.3)]"
          />
        )}
        <span className="relative">
          <Icon className={cn(nested ? 'w-4 h-4' : 'w-[18px] h-[18px]')} />
          {badge && (
            <span
              className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full"
              style={badge === 'gold'
                ? { background: 'radial-gradient(circle at 35% 30%, hsl(43 96% 75%) 0%, hsl(43 96% 50%) 60%, hsl(35 80% 38%) 100%)', boxShadow: '0 0 6px hsl(var(--primary)/0.85)' }
                : { background: 'radial-gradient(circle at 35% 30%, #FCA5A5 0%, #E11D48 60%, #9F1239 100%)', boxShadow: '0 0 6px rgba(239,68,68,0.85)' }}
            />
          )}
        </span>
        <span className="relative truncate">{tab.label}</span>
      </button>
    );
  };

  return (
    <aside
      className="fixed left-0 bottom-0 z-40 w-60 flex flex-col bg-background/95 backdrop-blur-xl border-r border-border/40"
      style={{ top: '3.5rem' }}
      role="navigation"
      aria-label="Primary"
    >
      <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-1">
        {/* Main sections — index drives the number-key shortcut hint (1..N),
            matching useDesktopNavShortcuts which keys off the same tab order.
            When a section's group is active, its sub-tabs nest directly below. */}
        {activeTabs.map((tab, i) => {
          const inGroup = !isWorldCup && !isUnemployed && !!tab.group?.includes(currentScreen);
          const subTabs = inGroup ? SUB_TABS[tab.screen] ?? null : null;
          return (
            <div key={tab.screen} className="flex flex-col gap-1">
              <NavButton tab={tab} layoutId="desktop-nav-pill" shortcut={i + 1} sectionActive={inGroup && currentScreen !== tab.screen} />
              {subTabs && (
                // Children sit under a connecting tree rail, indented from the
                // mother icon, so the grouping reads at a glance.
                <div className="relative ml-[1.55rem] pl-3 flex flex-col gap-1 border-l border-primary/40">
                  {subTabs.map(sub => (
                    <NavButton key={`sub-${sub.screen}`} tab={sub} layoutId="desktop-subnav-pill" nested />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Quick links + More — pinned to the bottom of the rail. */}
      {!isWorldCup && !isUnemployed && (
        <div className="px-3 py-3 border-t border-border/40 flex flex-col gap-1">
          {quickLinks.map(tab => (
            <NavButton key={`q-${tab.screen}`} tab={tab} layoutId="desktop-quick-pill" />
          ))}
        </div>
      )}
      {/* Discoverable entry point for the "?" keyboard-shortcuts sheet. */}
      <div className="px-3 pt-2 flex">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(SHORTCUTS_TOGGLE_EVENT))}
          title="Keyboard shortcuts (?)"
          aria-keyshortcuts="?"
          className="flex items-center gap-3 w-full h-9 px-3 rounded-lg text-[13px] font-medium text-foreground/60 hover:text-foreground hover:bg-foreground/[0.06] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Keyboard className="w-4 h-4" />
          <span>Shortcuts</span>
          <kbd className="ml-auto min-w-[1.4rem] px-1.5 h-5 inline-flex items-center justify-center rounded-md border border-border/70 bg-muted/40 text-[11px] font-semibold">?</kbd>
        </button>
      </div>
      {!isWorldCup && (
        <div className="px-3 pb-4 flex">
          <MoreDrawer disabled={matchLocked} open={drawerOpen} onOpenChange={setDrawerOpen} />
        </div>
      )}
    </aside>
  );
}
