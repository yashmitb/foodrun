/** $2, $1.50 — trim trailing .00 (matches reference screens). */
export function money(cents: number): string {
  const d = cents / 100;
  return Number.isInteger(d) ? `$${d}` : `$${d.toFixed(2)}`;
}

/** "9:30" from an ISO time, local, no am/pm (matches prototype). */
export function clockTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours() % 12 || 12;
  return `${h}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "1:42" mm:ss countdown to an ISO deadline; null when passed. */
export function countdown(untilIso: string, now = Date.now()): string | null {
  const ms = new Date(untilIso).getTime() - now;
  if (ms <= 0) return null;
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "updated just now" / "updated 1 min ago" (§6.5). */
export function updatedLabel(iso: string | null, now = Date.now()): string {
  if (!iso) return '';
  const mins = Math.floor((now - new Date(iso).getTime()) / 60_000);
  return mins <= 0 ? 'updated just now' : `updated ${mins} min ago`;
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function dayName(now = new Date()): string {
  return now.toLocaleDateString('en-US', { weekday: 'long' });
}
