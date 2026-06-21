import { useMemo, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { GameScreen } from '@/types/game';
import {
  LayoutDashboard, Users, Target, ArrowLeftRight, Briefcase, User, Mail, Trophy,
  Table2, CalendarDays, Dumbbell, UserCog, GraduationCap, Search, Package,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { MoreDrawer } from './MoreDrawer';
import { hapticLight } from '@/utils/haptics';
import { useMatchLocked, useCareerUnemployed } from '@/hooks/useGameSelectors';

// Desktop (Steam) top navigation bar. Rendered only in the Electron build by
// GameShell, replacing the mobile bottom pill + SubNav. Mirrors the bottom
// nav's tab sets/badges so behaviour stays identical; adds inline contextual
// sub-tabs and quick-links since a desktop top bar has the horizontal room.

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

// Contextual sub-tabs surfaced inline when the active screen is in a group.
const SUB_TABS: Partial<Record<GameScreen, Tab[]>> = {
  squad: [
    { screen: 'squad', label: 'Squad', icon: Users },
    { screen: 'training', label: 'Training', icon: Dumbbell },
    { screen: 'staff', label: 'Staff', icon: UserCog },
    { screen: 'youth-academy', label: 'Youth', icon: GraduationCap },
  ],
  transfers: [
    { screen: 'transfers', label: 'Market', icon: ArrowLeftRight },
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

  // Which main group, if any, is active — drives the inline sub-tab row.
  const subTabs = useMemo(() => {
    if (isWorldCup || isUnemployed) return null;
    for (const t of mainTabs) {
      if (t.group?.includes(currentScreen)) return SUB_TABS[t.screen] ?? null;
    }
    return null;
  }, [currentScreen, isWorldCup, isUnemployed]);

  const badgeFor = (screen: GameScreen): 'gold' | 'red' | null => {
    if ((screen === 'job-market' || screen === 'dashboard') && hasJobOffers) return 'gold';
    if (screen === 'dashboard' && unreadCount > 0) return 'red';
    if (screen === 'inbox' && unreadCount > 0) return 'red';
    if (screen === 'transfers' && pendingOffers > 0) return 'red';
    return null;
  };

  const NavButton = ({ tab, compact, layoutId }: { tab: Tab; compact?: boolean; layoutId: string }) => {
    const active = tab.group ? tab.group.includes(currentScreen) : currentScreen === tab.screen;
    const Icon = tab.icon;
    const badge = badgeFor(tab.screen);
    return (
      <button
        type="button"
        onClick={() => { if (matchLocked) return; hapticLight(); setScreen(tab.screen); }}
        aria-current={active ? 'page' : undefined}
        aria-disabled={matchLocked || undefined}
        className={cn(
          'relative flex items-center gap-2 px-3.5 h-9 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
          matchLocked ? 'opacity-50 cursor-not-allowed pointer-events-none'
            : active ? 'text-primary-foreground' : 'text-foreground/70 hover:text-foreground hover:bg-foreground/[0.06] cursor-pointer',
        )}
      >
        {active && (
          <motion.span
            layoutId={layoutId}
            initial={false}
            transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 38, mass: 0.8 }}
            className="absolute inset-0 rounded-lg bg-primary/90 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.2),0_2px_8px_hsl(var(--primary)/0.3)]"
          />
        )}
        <span className="relative inline-flex items-center gap-2">
          <span className="relative">
            <Icon className="w-4 h-4" />
            {badge && (
              <span
                className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full"
                style={badge === 'gold'
                  ? { background: 'radial-gradient(circle at 35% 30%, hsl(43 96% 75%) 0%, hsl(43 96% 50%) 60%, hsl(35 80% 38%) 100%)', boxShadow: '0 0 6px hsl(var(--primary)/0.85)' }
                  : { background: 'radial-gradient(circle at 35% 30%, #FCA5A5 0%, #E11D48 60%, #9F1239 100%)', boxShadow: '0 0 6px rgba(239,68,68,0.85)' }}
              />
            )}
          </span>
          {!compact && <span>{tab.label}</span>}
        </span>
      </button>
    );
  };

  return (
    <header
      className="fixed left-0 right-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/40"
      style={{ top: '3.5rem' }}
      role="navigation"
      aria-label="Primary"
    >
      <div className="mx-auto w-full max-w-[110rem] px-6 lg:px-8 flex items-center gap-1 h-12">
        {/* Main sections */}
        {activeTabs.map(tab => <NavButton key={tab.screen} tab={tab} layoutId="desktop-nav-pill" />)}

        {/* Contextual sub-tabs for the active group */}
        {subTabs && (
          <>
            <div className="mx-2 h-6 w-px bg-border/50" />
            {subTabs.map(tab => <NavButton key={`sub-${tab.screen}`} tab={tab} layoutId="desktop-subnav-pill" />)}
          </>
        )}

        <div className="flex-1" />

        {/* Quick links + More */}
        {!isWorldCup && !isUnemployed && quickLinks.map(tab => (
          <NavButton key={`q-${tab.screen}`} tab={tab} compact layoutId="desktop-quick-pill" />
        ))}
        {!isWorldCup && <MoreDrawer disabled={matchLocked} open={drawerOpen} onOpenChange={setDrawerOpen} />}
      </div>
    </header>
  );
}
