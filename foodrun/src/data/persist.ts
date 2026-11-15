import { useEffect, useState } from 'react';

import { KEYS, loadJSON, remove, saveJSON } from '@/lib/storage';
import { useStore } from '@/data/store';
import type { Profile } from '@/data/types';

/**
 * What survives closing the app.
 *
 * Deliberately not the whole store. Runs and orders are server state in
 * Phase 3 and mock fixtures until then — restoring a stale order from disk
 * would show someone a delivery that is not happening. What is worth keeping
 * is who you are and where you usually sit: answering "which library are you
 * in" on every cold start is exactly the friction the research complained
 * about.
 */
type Persisted = {
  signedIn: boolean;
  onboarded: boolean;
  nameIsGuess: boolean;
  me: Profile | null;
  destinationId: string;
  dropSpot: string | null;
  recentSpots: string[];
};

function snapshot(): Persisted {
  const s = useStore.getState();
  return {
    signedIn: s.signedIn,
    onboarded: s.onboarded,
    nameIsGuess: s.nameIsGuess,
    me: s.me,
    destinationId: s.destinationId,
    dropSpot: s.dropSpot,
    recentSpots: s.recentSpots,
  };
}

function same(a: Persisted, b: Persisted): boolean {
  return (
    a.signedIn === b.signedIn &&
    a.onboarded === b.onboarded &&
    a.nameIsGuess === b.nameIsGuess &&
    a.me?.id === b.me?.id &&
    a.me?.name === b.me?.name &&
    a.destinationId === b.destinationId &&
    a.dropSpot === b.dropSpot &&
    a.recentSpots.join('|') === b.recentSpots.join('|')
  );
}

let started = false;

/**
 * Reads the saved slice once, then writes it back whenever it changes.
 *
 * Returns false until the read finishes, so the router can wait instead of
 * flashing the sign-in screen at someone who is already signed in.
 */
export function usePersistedSession(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await loadJSON<Persisted | null>(KEYS.session, null);
      if (cancelled) return;
      if (saved?.signedIn && saved.me) {
        useStore.setState({
          signedIn: true,
          onboarded: saved.onboarded,
          nameIsGuess: saved.nameIsGuess ?? false,
          me: saved.me,
          dropSpot: saved.dropSpot,
          ...(saved.recentSpots?.length ? { recentSpots: saved.recentSpots } : {}),
        });
        // Runs are re-seeded for the restored destination rather than
        // restored: a run that was leaving an hour ago is not news.
        useStore.getState().setDestination(saved.destinationId);
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (started) return;
    started = true;
    let previous = snapshot();
    useStore.subscribe(() => {
      const next = snapshot();
      if (same(previous, next)) return;
      previous = next;
      if (next.signedIn) void saveJSON(KEYS.session, next);
      else void remove(KEYS.session);
    });
  }, []);

  return ready;
}
