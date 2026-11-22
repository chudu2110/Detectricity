import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSystemReducedMotion } from './use-system-reduced-motion';

/** A scene clock on the UI thread. Every illustration layer uses the same phase. */
export function useMotionPhase(active: boolean, durationMs: number) {
  const reduced = useSystemReducedMotion();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const phase = useSharedValue(0);

  useEffect(() => {
    const app = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => app.remove();
  }, []);

  useEffect(() => {
    if (reduced) {
      phase.set(0);
    } else if (active && foreground) {
      // Start the next revolution at the frozen angle when the scene becomes visible again.
      phase.set(
        withRepeat(
          withTiming(phase.get() + 1, {
            duration: durationMs,
            easing: Easing.linear,
            reduceMotion: ReduceMotion.Never,
          }),
          -1,
          false,
          undefined,
          ReduceMotion.Never,
        ),
      );
    }
    return () => cancelAnimation(phase);
  }, [active, durationMs, foreground, phase, reduced]);
  return phase;
}
