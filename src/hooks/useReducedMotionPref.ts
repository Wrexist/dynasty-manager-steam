import { useReducedMotion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';

/**
 * True when motion should be reduced. Combines THREE signals:
 *  - the OS `prefers-reduced-motion` setting (via framer's `useReducedMotion`),
 *  - the in-game **Reduced Motion** toggle (`settings.reducedMotion`),
 *  - **Performance Mode** (`settings.performanceMode`).
 *
 * Why this exists: framer's `MotionConfig reducedMotion` only disables
 * *transform* and *layout* animations — it does NOT stop infinite `opacity`,
 * `borderColor`, or `filter` loops. Gate ambient decorative loops (pulse rings,
 * glows) on this hook so they go static for users who asked for less motion,
 * regardless of which of the three signals they used.
 *
 * Scope to **ambient** loops (things that run continuously in the background).
 * Leave user-initiated spectacle (pack walkouts, goal celebrations) to framer's
 * own handling — those are momentary and expected.
 */
export function useReducedMotionPref(): boolean {
  const osReduced = useReducedMotion();
  const inGameReduced = useGameStore(s => s.settings.reducedMotion || s.settings.performanceMode);
  return !!osReduced || !!inGameReduced;
}
