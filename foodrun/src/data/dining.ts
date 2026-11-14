import seed from './ucsd_dining.json';

import type { Destination, Hall } from './types';

/**
 * Seed from foodrun-context/data/ucsd_dining.json.
 * Station lists change by quarter — treat as editable seed, moves to DB in Phase 3.
 */
export const HALLS: Hall[] = (seed.halls as Hall[]).filter((h) => h.triton2go);

export const DESTINATIONS: Destination[] = seed.destinations as Destination[];

export function hallById(id: string): Hall | undefined {
  return HALLS.find((h) => h.id === id);
}

export function destinationById(id: string): Destination | undefined {
  return DESTINATIONS.find((d) => d.id === id);
}

/** "9am-11pm" | "closed" for today, or null when unknown. */
export function hoursToday(hall: Hall, now = new Date()): string | null {
  const key = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getDay()];
  return hall.hours?.[key] ?? null;
}

/** §8 — dining hall closed → hide from filters, block posting runs. */
export function isOpenNow(hall: Hall, now = new Date()): boolean {
  const h = hoursToday(hall, now);
  if (!h || h === 'closed') return false;
  const m = h.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)-(\d{1,2})(?::(\d{2}))?(am|pm)$/i);
  if (!m) return true; // unparseable → do not hide
  const [, oh, om, oap, ch, cm, cap] = m;
  const to24 = (hh: string, mm: string | undefined, ap: string) => {
    let v = (parseInt(hh, 10) % 12) + (ap.toLowerCase() === 'pm' ? 12 : 0);
    return v * 60 + (mm ? parseInt(mm, 10) : 0);
  };
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins >= to24(oh, om, oap) && mins < to24(ch, cm, cap);
}
