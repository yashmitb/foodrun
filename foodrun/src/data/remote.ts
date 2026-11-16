import type { RealtimeChannel } from '@supabase/supabase-js';

import type {
  OrderEventRow,
  OrderRow,
  OrderStatus,
  PublicProfileRow,
  RunRow,
  RunnerOrderRow,
} from '@/data/database.types';
import type { Order, OrderEvent, Profile, Run, RunnerOrder } from '@/data/types';
import { requireSupabase } from '@/lib/supabase';

/**
 * Every read and write against the real database.
 *
 * Writes go through the RPCs in 0003_hardening.sql rather than touching
 * tables, because the client is not allowed to choose a fee, a handoff code,
 * an order status or a rating. The functions validate and derive; this file
 * only passes along what the user actually typed.
 *
 * Reads come back as rows and are mapped into the app's own types here, so
 * the screens never learn what Postgres calls anything.
 */

// ------------------------------------------------------------------ mapping

function initialsOf(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('')
      .slice(0, 2) || 'T'
  );
}

export function toProfile(row: PublicProfileRow, email = ''): Profile {
  return {
    id: row.id,
    name: row.name,
    firstName: row.name.trim().split(/\s+/)[0] ?? row.name,
    initials: initialsOf(row.name),
    ucsdEmail: email,
    ratingAvg: Number(row.rating_avg),
    ratingCount: row.rating_count,
  };
}

type RunWithRunner = RunRow & { runner: PublicProfileRow | null };

function toRun(row: RunWithRunner): Run {
  return {
    id: row.id,
    runner: toProfile(
      row.runner ?? {
        id: row.runner_id,
        name: 'Runner',
        avatar_url: null,
        rating_avg: 5,
        rating_count: 0,
      },
    ),
    hallId: row.hall_id,
    destinationId: row.destination_id,
    leaveAt: row.leave_at,
    spotsTotal: row.spots_total,
    spotsLeft: row.spots_left,
    feeCents: row.fee_cents,
    status: row.status,
  };
}

/** §6.5 — the timeline is read from order_events, never assembled client-side. */
const EVENT_LABEL: Record<OrderStatus, (who: string) => string> = {
  pending: (who) => `You joined ${who}'s run`,
  confirmed: (who) => `${who} will grab your order`,
  picked_up: (who) => `${who} picked up your bag`,
  on_the_way: (who) => `${who} left for your drop spot`,
  arrived: (who) => `${who} is at your drop spot`,
  delivered: () => 'Delivered',
  cancelled: () => 'Order cancelled',
  problem: (who) => `${who} reported a problem`,
};

function toEvents(rows: OrderEventRow[], runnerFirst: string): OrderEvent[] {
  return rows.map((e) => ({
    id: e.id,
    status: e.status,
    label: e.note ?? EVENT_LABEL[e.status]?.(runnerFirst) ?? e.status,
    at: e.created_at,
  }));
}

function toOrder(row: OrderRow, restaurant: string, events: OrderEvent[]): Order {
  return {
    id: row.id,
    runId: row.run_id,
    ordererId: row.orderer_id,
    hallId: row.hall_id,
    restaurant,
    t2gLast4: row.t2g_last4,
    orderName: row.order_name ?? '',
    dropSpotText: row.drop_spot_text,
    handoffCode: row.handoff_code,
    status: row.status,
    cancelUntil: row.cancel_until,
    feeCents: row.fee_cents,
    etaMinutes: null,
    etaUpdatedAt: null,
    events,
  };
}

function toRunnerOrder(row: RunnerOrderRow): RunnerOrder {
  return {
    id: row.id,
    runId: row.run_id,
    ordererId: '',
    ordererName: row.orderer_first_name,
    hallId: '',
    restaurant: row.restaurant ?? '',
    t2gLast4: row.t2g_last4,
    orderName: row.order_name ?? '',
    dropSpotText: row.drop_spot_text,
    // The runner is never sent a handoff code (§5); they type the one the
    // orderer shows them and the server compares it.
    handoffCode: '',
    status: row.status,
    cancelUntil: row.cancel_until,
    feeCents: row.fee_cents,
    etaMinutes: null,
    etaUpdatedAt: null,
    events: [],
  };
}

// -------------------------------------------------------------------- reads

const RUN_SELECT = '*, runner:public_profiles!runs_runner_id_fkey(*)';

/** Open and scheduled runs, soonest first. */
export async function fetchRuns(): Promise<Run[]> {
  const { data, error } = await requireSupabase()
    .from('runs')
    .select(RUN_SELECT)
    .in('status', ['open', 'scheduled'])
    .gte('leave_at', new Date(Date.now() - 15 * 60_000).toISOString())
    .order('leave_at', { ascending: true })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data as unknown as RunWithRunner[]).map(toRun);
}

/** The caller's own live order, with its timeline. */
export async function fetchMyOrder(runnerFirst = 'Your runner'): Promise<Order | null> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('orders')
    .select('*, restaurants(name)')
    .not('status', 'in', '("cancelled")')
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  // The hand-written Database type carries no relationship metadata, so an
  // embedded select cannot be inferred. Regenerating types against the live
  // project (supabase gen types) removes the need for this cast.
  const row = data?.[0] as unknown as
    | (OrderRow & { restaurants: { name: string } | null })
    | undefined;
  if (!row) return null;

  const { data: events } = await supabase
    .from('order_events')
    .select('*')
    .eq('order_id', row.id)
    .order('created_at', { ascending: true });

  return toOrder(row, row.restaurants?.name ?? '', toEvents(events ?? [], runnerFirst));
}

/** The caller's live run, if they are running one. */
export async function fetchMyRun(userId: string): Promise<Run | null> {
  const { data, error } = await requireSupabase()
    .from('runs')
    .select(RUN_SELECT)
    .eq('runner_id', userId)
    .in('status', ['scheduled', 'open', 'picking_up', 'delivering'])
    .limit(1);
  if (error) throw new Error(error.message);
  const row = data?.[0] as unknown as RunWithRunner | undefined;
  return row ? toRun(row) : null;
}

/** Orders on the caller's run, through the view that omits the handoff code. */
export async function fetchMyRunOrders(runId: string): Promise<RunnerOrder[]> {
  const { data, error } = await requireSupabase()
    .from('orders_for_runner')
    .select('*')
    .eq('run_id', runId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data as RunnerOrderRow[]).map(toRunnerOrder);
}

/**
 * The id of a station, looked up by the name the sheet shows.
 *
 * The chips come from the bundled ucsd_dining.json, and the seed is
 * generated from that same file, so the names line up. Resolving here rather
 * than threading ids through the join sheet keeps the screens unaware that a
 * database exists; if a name ever fails to match, the order still goes
 * through without a station rather than failing at the last step.
 */
export async function fetchRestaurantId(hallId: string, name: string): Promise<string | null> {
  if (!name) return null;
  const { data, error } = await requireSupabase()
    .from('restaurants')
    .select('id')
    .eq('hall_id', hallId)
    .eq('name', name)
    .limit(1);
  if (error) return null;
  return data?.[0]?.id ?? null;
}

// ------------------------------------------------------------------- writes

export async function postRun(p: {
  hallId: string;
  destinationId: string;
  leaveAt: string;
  spots: number;
  feeCents: number;
}): Promise<Run> {
  const { data, error } = await requireSupabase().rpc('post_run', {
    p_hall_id: p.hallId,
    p_destination_id: p.destinationId,
    p_leave_at: p.leaveAt,
    p_spots: p.spots,
    p_fee_cents: p.feeCents,
  });
  if (error) throw new Error(error.message);
  return toRun({ ...(data as RunRow), runner: null });
}

export async function joinRun(p: {
  runId: string;
  restaurantId: string | null;
  last4: string;
  orderName: string;
  dropSpot: string;
}): Promise<Order> {
  const { data, error } = await requireSupabase().rpc('join_run', {
    p_run_id: p.runId,
    p_restaurant_id: p.restaurantId,
    p_t2g_last4: p.last4,
    p_order_name: p.orderName,
    p_drop_spot_text: p.dropSpot,
  });
  if (error) throw new Error(error.message);
  return toOrder(data as OrderRow, '', []);
}

export async function cancelOrder(orderId: string): Promise<void> {
  const { error } = await requireSupabase().rpc('cancel_order', { p_order_id: orderId });
  if (error) throw new Error(error.message);
}

export async function runnerSetStatus(orderId: string, status: OrderStatus): Promise<void> {
  const { error } = await requireSupabase().rpc('runner_set_status', {
    p_order_id: orderId,
    p_status: status,
  });
  if (error) throw new Error(error.message);
}

/**
 * Returns false on a wrong code rather than throwing, because a mistyped
 * code is an expected outcome at a handoff, not an error.
 */
export async function runnerDeliver(orderId: string, code: string): Promise<boolean> {
  const { error } = await requireSupabase().rpc('runner_deliver', {
    p_order_id: orderId,
    p_code: code,
  });
  if (!error) return true;
  if (/did not match|Too many wrong/i.test(error.message)) return false;
  throw new Error(error.message);
}

export async function rateOrder(orderId: string, stars: number, note?: string): Promise<void> {
  const { error } = await requireSupabase().rpc('rate_order', {
    p_order_id: orderId,
    p_stars: stars,
    p_note: note ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function reportOrder(
  orderId: string,
  reason: 'late' | 'wrong_or_missing' | 'cannot_find_runner' | 'other',
  note?: string,
): Promise<void> {
  const { error } = await requireSupabase().rpc('report_order', {
    p_order_id: orderId,
    p_reason: reason,
    p_note: note ?? null,
  });
  if (error) throw new Error(error.message);
}

/** §6.4 — closing the window is a read, so anything reading triggers it. */
export async function settleCancelWindows(): Promise<void> {
  const { error } = await requireSupabase().rpc('settle_cancel_windows');
  if (error) throw new Error(error.message);
}

// ----------------------------------------------------------------- realtime

/**
 * §6.5 — the orderer's bar moves from the runner's real actions.
 *
 * Realtime respects the same policies as a query, so this only ever delivers
 * rows the caller is allowed to see.
 */
export function subscribeToOrder(orderId: string, onChange: () => void): RealtimeChannel {
  return requireSupabase()
    .channel(`order:${orderId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
      onChange,
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'order_events', filter: `order_id=eq.${orderId}` },
      onChange,
    )
    .subscribe();
}

export function subscribeToRun(runId: string, onChange: () => void): RealtimeChannel {
  return requireSupabase()
    .channel(`run:${runId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders', filter: `run_id=eq.${runId}` },
      onChange,
    )
    .subscribe();
}
