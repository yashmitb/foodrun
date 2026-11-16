import { useEffect } from 'react';

import * as remote from '@/data/remote';
import { useStore, type JoinDraft, type JoinResult } from '@/data/store';
import type { ReportReason, Run } from '@/data/types';
import { isBackendConfigured } from '@/lib/supabase';

/**
 * One door in front of both data sources.
 *
 * With a Supabase project configured these call the database; without one
 * they call the in-memory store the demo has always used. Screens call this
 * module and never branch on which is in play, so the mock path keeps
 * working and keeps being the thing that runs in development.
 *
 * Everything here is async. The mock actions are synchronous and stay that
 * way, but a screen cannot know which it is talking to, so the slower shape
 * wins.
 */

export const usingDatabase = isBackendConfigured;

/** Re-read everything this user can see. Cheap enough to call after a write. */
export async function refresh(): Promise<void> {
  if (!usingDatabase) return;
  const me = useStore.getState().me;
  const [runs, myOrder] = await Promise.all([remote.fetchRuns(), remote.fetchMyOrder()]);
  const myRun = me ? await remote.fetchMyRun(me.id) : null;
  const myRunOrders = myRun ? await remote.fetchMyRunOrders(myRun.id) : [];
  useStore.setState({ runs, myOrder, myRun, myRunOrders });
}

export async function joinRun(draft: Required<JoinDraft>): Promise<JoinResult> {
  const s = useStore.getState();
  if (!usingDatabase) return s.joinRun(draft);

  try {
    // The sheet works in station names; the database keys on ids.
    const run = s.runs.find((r) => r.id === draft.runId);
    const restaurantId = run
      ? await remote.fetchRestaurantId(run.hallId, draft.restaurant ?? '')
      : null;
    await remote.joinRun({
      runId: draft.runId,
      restaurantId,
      last4: draft.last4,
      orderName: draft.orderName,
      // Required<> keeps the null in `string | null`; the server rejects
      // an empty spot anyway, which is the right answer either way.
      dropSpot: draft.dropSpot ?? '',
    });
    await refresh();
    const order = useStore.getState().myOrder;
    return order ? { ok: true, order } : { ok: false, reason: 'not_found' };
  } catch (e) {
    return { ok: false, reason: reasonFor(e) };
  }
}

/** Map the database's own words onto the three cases the sheet knows about. */
function reasonFor(e: unknown): 'full' | 'has_order' | 'not_found' {
  const m = e instanceof Error ? e.message : '';
  if (/filled up/i.test(m)) return 'full';
  if (/in flight/i.test(m)) return 'has_order';
  return 'not_found';
}

export async function cancelMyOrder(): Promise<void> {
  const s = useStore.getState();
  if (!usingDatabase) return s.cancelMyOrder();
  const order = s.myOrder;
  if (!order) return;
  await remote.cancelOrder(order.id);
  await refresh();
}

export async function postRun(p: {
  hallId: string;
  destinationId: string;
  leaveAt: string;
  spots: number;
  feeCents: number;
}): Promise<Run> {
  const s = useStore.getState();
  if (!usingDatabase) return s.postRun(p);
  const run = await remote.postRun(p);
  await refresh();
  return run;
}

export async function runnerMarkPickedUp(orderId: string): Promise<void> {
  const s = useStore.getState();
  if (!usingDatabase) return s.runnerMarkPickedUp(orderId);
  await remote.runnerSetStatus(orderId, 'picked_up');
  await refresh();
}

export async function runnerMarkNotReady(orderId: string): Promise<void> {
  const s = useStore.getState();
  if (!usingDatabase) return s.runnerMarkNotReady(orderId);
  await remote.runnerSetStatus(orderId, 'problem');
  await refresh();
}

export async function runnerStartDelivering(): Promise<void> {
  const s = useStore.getState();
  if (!usingDatabase) return s.runnerStartDelivering();
  const picked = s.myRunOrders.filter((o) => o.status === 'picked_up');
  for (const o of picked) await remote.runnerSetStatus(o.id, 'on_the_way');
  await refresh();
}

export async function runnerDeliver(orderId: string, code: string): Promise<boolean> {
  const s = useStore.getState();
  if (!usingDatabase) return s.runnerDeliver(orderId, code);
  const ok = await remote.runnerDeliver(orderId, code);
  await refresh();
  return ok;
}

export async function rateRunner(stars: number): Promise<void> {
  const s = useStore.getState();
  if (!usingDatabase) return s.rateRunner(stars);
  const order = s.myOrder;
  if (!order) return;
  await remote.rateOrder(order.id, stars);
  await refresh();
}

export async function reportProblem(reason: ReportReason): Promise<void> {
  const s = useStore.getState();
  if (!usingDatabase) return s.reportProblem(reason);
  const order = s.myOrder;
  if (!order) return;
  const map: Record<ReportReason, 'late' | 'wrong_or_missing' | 'cannot_find_runner' | 'other'> = {
    'Runner is late': 'late',
    'Wrong or missing item': 'wrong_or_missing',
    "Can't find my runner": 'cannot_find_runner',
    Other: 'other',
  };
  await remote.reportOrder(order.id, map[reason]);
  await refresh();
}

/**
 * Keeps the store in step with the database.
 *
 * §6.5 wants the orderer's bar to move from the runner's real actions, which
 * is a Realtime subscription rather than a poll. The slow interval underneath
 * it is only there to close cancel windows, which is a clock passing rather
 * than anyone doing something, so nothing pushes it.
 */
export function useBackendSync(): void {
  const signedIn = useStore((s) => s.signedIn);
  const orderId = useStore((s) => s.myOrder?.id ?? null);
  const runId = useStore((s) => s.myRun?.id ?? null);

  useEffect(() => {
    if (!usingDatabase || !signedIn) return;
    void refresh();
    const id = setInterval(() => {
      void remote.settleCancelWindows().then(refresh).catch(() => {});
    }, 20_000);
    return () => clearInterval(id);
  }, [signedIn]);

  useEffect(() => {
    if (!usingDatabase || !orderId) return;
    const channel = remote.subscribeToOrder(orderId, () => void refresh());
    return () => void channel.unsubscribe();
  }, [orderId]);

  useEffect(() => {
    if (!usingDatabase || !runId) return;
    const channel = remote.subscribeToRun(runId, () => void refresh());
    return () => void channel.unsubscribe();
  }, [runId]);
}
