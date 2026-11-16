/** Mirrors the Supabase schema in foodrun-context/CLAUDE.md §5 so Phase 3 is a swap. */

export type Hall = {
  id: string;
  name: string;
  college: string | null;
  triton2go: boolean;
  hours: Record<string, string>;
  restaurants: string[];
  note?: string;
};

export type Destination = {
  id: string;
  name: string;
  spots_hint?: string;
};

export type Profile = {
  id: string;
  name: string;
  firstName: string;
  initials: string;
  ucsdEmail: string;
  ratingAvg: number;
  ratingCount: number;
};

export type RunStatus =
  | 'scheduled'
  | 'open'
  | 'picking_up'
  | 'delivering'
  | 'done'
  | 'cancelled';

export type Run = {
  id: string;
  runner: Profile;
  hallId: string;
  destinationId: string;
  /** ISO time the runner leaves the hall. */
  leaveAt: string;
  spotsTotal: number;
  spotsLeft: number;
  feeCents: number;
  status: RunStatus;
};

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'picked_up'
  | 'on_the_way'
  | 'arrived'
  | 'delivered'
  | 'cancelled'
  | 'problem';

export type OrderEvent = {
  id: string;
  status: OrderStatus | 'not_ready';
  label: string;
  at: string; // ISO
};

export type Order = {
  id: string;
  runId: string;
  ordererId: string;
  hallId: string;
  restaurant: string;
  /** ONLY the last 4 digits of the Triton2Go order number (§5). */
  t2gLast4: string;
  /** Name on the Triton2Go order, helps the runner match bags. */
  orderName: string;
  dropSpotText: string;
  handoffCode: string;
  status: OrderStatus;
  /** Free-cancel deadline (§6.4): min(join + 2min, run.leaveAt). */
  cancelUntil: string;
  feeCents: number;
  etaMinutes: number | null;
  etaUpdatedAt: string | null;
  events: OrderEvent[];
  rating?: number;
};

/** An order as its runner sees it: a first name, never a handoff code (§5). */
export type RunnerOrder = Order & { ordererName: string };

export type ReportReason =
  | 'Runner is late'
  | 'Wrong or missing item'
  | "Can't find my runner"
  | 'Other';
