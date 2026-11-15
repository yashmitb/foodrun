import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useStore } from '@/data/store';

/**
 * One app-wide 1s clock. Mounted at the root so order progress keeps moving
 * while the user is on any tab (a per-screen interval froze it off-screen).
 * Pauses in the background and catches up on resume.
 */
export function useAppClock() {
  const tick = useStore((s) => s.tick);
  const tickRun = useStore((s) => s.tickRun);

  useEffect(() => {
    const run = () => {
      tick();
      tickRun();
    };
    let id: ReturnType<typeof setInterval> | null = setInterval(run, 1000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        run();
        if (!id) id = setInterval(run, 1000);
      } else if (id) {
        clearInterval(id);
        id = null;
      }
    });
    return () => {
      if (id) clearInterval(id);
      sub.remove();
    };
  }, [tick, tickRun]);
}

/**
 * Re-renders once a second and returns the current epoch ms. For countdowns
 * and "x min ago" labels — keeps `Date.now()` out of render (purity rule).
 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
