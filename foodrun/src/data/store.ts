import { create } from 'zustand';

import { destinationById, hallById } from './dining';
import type {
  Order,
  OrderEvent,
  OrderStatus,
  Profile,
  ReportReason,
  Run,
} from './types';

/**
 * Phase 2 mock store. Shapes mirror §5 so Phase 3 swaps this for Supabase.
 * In mock mode a fake runner advances a joined order on a timer; from Phase 4
 * status changes come only from real runner actions over Realtime (P5).
 */

const uid = () => Math.random().toString(36).slice(2, 10);
const nowIso = () => new Date().toISOString();
const minsFromNow = (m: number) => new Date(Date.now() + m * 60_000).toISOString();

const mkProfile = (name: string, email: string, rating = 4.8, count = 23): Profile => {
  const parts = name.trim().split(/\s+/);
  return {
    id: uid(),
    name,
    firstName: parts[0],
    initials:
      parts
        .map((p) => p[0]?.toUpperCase() ?? '')
        .join('')
        .slice(0, 2) || 'T',
    ucsdEmail: email,
    ratingAvg: rating,
    ratingCount: count,
  };
};

const MARCUS = mkProfile('Marcus J.', 'marcusj@ucsd.edu', 4.8, 41);
const ANA = mkProfile('Ana L.', 'anal@ucsd.edu', 4.9, 58);
const JAY = mkProfile('Jay K.', 'jayk@ucsd.edu', 4.6, 12);
const SAM = mkProfile('Sam R.', 'samr@ucsd.edu', 4.7, 9);
const NOOR = mkProfile('Noor H.', 'noorh@ucsd.edu', 5.0, 6);

function seedRuns(destinationId: string): Run[] {
  return [
    {
      id: uid(),
      runner: MARCUS,
      hallId: 'pines',
      destinationId,
      leaveAt: minsFromNow(6),
      spotsTotal: 3,
      spotsLeft: 3,
      feeCents: 200,
      status: 'open',
    },
    {
      id: uid(),
      runner: ANA,
      hallId: 'oceanview',
      destinationId,
      leaveAt: minsFromNow(16),
      spotsTotal: 2,
      spotsLeft: 2,
      feeCents: 200,
      status: 'open',
    },
    {
      id: uid(),
      runner: JAY,
      hallId: '64-degrees',
      destinationId,
      leaveAt: minsFromNow(21),
      spotsTotal: 4,
      spotsLeft: 4,
      feeCents: 150,
      status: 'open',
    },
    {
      id: uid(),
      runner: NOOR,
      hallId: 'pines',
      destinationId: 'price-center',
      leaveAt: minsFromNow(11),
      spotsTotal: 2,
      spotsLeft: 1,
      feeCents: 200,
      status: 'open',
    },
    // Scheduled for later tonight (§6.2 Now/Scheduled toggle)
    {
      id: uid(),
      runner: SAM,
      hallId: 'ventanas',
      destinationId,
      leaveAt: minsFromNow(95),
      spotsTotal: 3,
      spotsLeft: 3,
      feeCents: 200,
      status: 'scheduled',
    },
  ];
}

const FREE_CANCEL_MS = 2 * 60_000;
/** Mock-runner pacing (replaced by real actions in Phase 4). */
const DEMO_STEP_MS = 25_000;

export type JoinDraft = {
  runId: string;
  restaurant: string | null;
  last4: string;
  orderName: string;
  dropSpot: string | null;
};

type RunnerOrder = Order & { ordererName: string };

/** Why a join was refused, so the sheet can say something useful. */
export type JoinResult =
  | { ok: true; order: Order }
  | { ok: false; reason: 'full' | 'has_order' | 'not_found' };

/** An order still in flight — blocks joining a second run. */
export function isActiveOrder(o: Order | null): o is Order {
  return !!o && o.status !== 'delivered' && o.status !== 'cancelled';
}

type State = {
  // session
  signedIn: boolean;
  onboarded: boolean;
  me: Profile | null;
  /** True while `me.name` is still the guess made from the email handle. */
  nameIsGuess: boolean;
  destinationId: string;
  dropSpot: string | null;
  recentSpots: string[];

  // orderer
  runs: Run[];
  myOrder: Order | null;
  pastOrders: Order[];

  // runner
  myRun: Run | null;
  myRunOrders: RunnerOrder[];
  earningsCents: number;
  deliveredCount: number;

  // actions
  signIn: (email: string) => void;
  signOut: () => void;
  completeOnboarding: (name: string, destinationId: string) => void;
  setDestination: (id: string) => void;
  setDropSpot: (spot: string) => void;

  joinRun: (draft: Required<JoinDraft>) => JoinResult;
  cancelMyOrder: () => void;
  tick: () => void;
  /** Advances runner-side orders: pending → confirmed when the window ends. */
  tickRun: () => void;
  rateRunner: (stars: number) => void;
  reportProblem: (reason: ReportReason) => void;

  postRun: (p: {
    hallId: string;
    destinationId: string;
    leaveAt: string;
    spots: number;
    feeCents: number;
  }) => Run;
  runnerMarkPickedUp: (orderId: string) => void;
  runnerMarkNotReady: (orderId: string) => void;
  runnerStartDelivering: () => void;
  runnerDeliver: (orderId: string, code: string) => boolean;
  endMyRun: () => void;
};

function pushEvent(order: Order, status: OrderEvent['status'], label: string): Order {
  const ev: OrderEvent = { id: uid(), status, label, at: nowIso() };
  return { ...order, events: [...order.events, ev] };
}

export const useStore = create<State>((set, get) => ({
  signedIn: false,
  onboarded: false,
  me: null,
  destinationId: 'geisel',
  dropSpot: null,
  recentSpots: ['Geisel 2F, Table 14', 'Geisel 8F, East window', 'Price Center, Lobby couches'],

  runs: [],
  nameIsGuess: false,

  myOrder: null,
  pastOrders: [],

  myRun: null,
  myRunOrders: [],
  earningsCents: 0,
  deliveredCount: 0,

  signIn: (email) => {
    const handle = email.split('@')[0];
    const pretty = handle
      .split(/[._\d]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    set({
      signedIn: true,
      // Derived from the email, so onboarding must treat it as a suggestion.
      nameIsGuess: true,
      me: mkProfile(pretty || 'Triton', email, 5.0, 0),
      runs: seedRuns(get().destinationId),
    });
  },
  signOut: () =>
    set({
      signedIn: false,
      onboarded: false,
      nameIsGuess: false,
      me: null,
      myOrder: null,
      myRun: null,
      myRunOrders: [],
    }),
  completeOnboarding: (name, destinationId) => {
    const me = get().me;
    set({
      onboarded: true,
      nameIsGuess: false,
      me: me ? { ...mkProfile(name, me.ucsdEmail, 5.0, 0), id: me.id } : me,
      destinationId,
      runs: seedRuns(destinationId),
    });
  },
  setDestination: (id) => set({ destinationId: id }),
  setDropSpot: (spot) =>
    set((s) => ({
      dropSpot: spot,
      recentSpots: [spot, ...s.recentSpots.filter((x) => x !== spot)].slice(0, 3),
    })),

  joinRun: (draft) => {
    const s = get();
    const run = s.runs.find((r) => r.id === draft.runId);
    if (!run || !s.me) return { ok: false, reason: 'not_found' };
    if (run.spotsLeft <= 0) return { ok: false, reason: 'full' };
    // One order at a time. A finished-but-unrated order is archived instead.
    if (isActiveOrder(s.myOrder)) return { ok: false, reason: 'has_order' };
    const archived = s.myOrder ? [s.myOrder, ...s.pastOrders] : s.pastOrders;
    const cancelUntil = new Date(
      Math.min(Date.now() + FREE_CANCEL_MS, new Date(run.leaveAt).getTime()),
    ).toISOString();
    let order: Order = {
      id: uid(),
      runId: run.id,
      ordererId: s.me.id,
      hallId: run.hallId,
      restaurant: draft.restaurant!,
      t2gLast4: draft.last4,
      orderName: draft.orderName,
      dropSpotText: draft.dropSpot!,
      handoffCode: String(Math.floor(1000 + Math.random() * 9000)),
      status: 'pending',
      cancelUntil,
      feeCents: run.feeCents,
      etaMinutes: null,
      etaUpdatedAt: null,
      events: [],
    };
    order = pushEvent(order, 'pending', `You joined ${run.runner.firstName}'s run`);
    set({
      myOrder: order,
      pastOrders: archived,
      dropSpot: draft.dropSpot,
      runs: s.runs.map((r) => (r.id === run.id ? { ...r, spotsLeft: r.spotsLeft - 1 } : r)),
    });
    return { ok: true, order };
  },

  cancelMyOrder: () => {
    const s = get();
    const o = s.myOrder;
    if (!o || ['picked_up', 'on_the_way', 'arrived', 'delivered'].includes(o.status)) return;
    set({
      myOrder: null,
      runs: s.runs.map((r) => (r.id === o.runId ? { ...r, spotsLeft: r.spotsLeft + 1 } : r)),
    });
  },

  /**
   * Called by screens on an interval. Confirms pending orders whose cancel
   * window ended, ticks the ETA each minute, and (mock only) advances the
   * fake runner.
   */
  tick: () => {
    const s = get();
    const o = s.myOrder;
    if (!o) return;
    const run = s.runs.find((r) => r.id === o.runId);
    const runnerFirst = run?.runner.firstName ?? 'Your runner';
    const now = Date.now();

    if (o.status === 'pending' && now >= new Date(o.cancelUntil).getTime()) {
      let next = { ...o, status: 'confirmed' as OrderStatus };
      next = pushEvent(next, 'confirmed', `${runnerFirst} will grab your order`);
      next.etaMinutes = run
        ? Math.max(3, Math.round((new Date(run.leaveAt).getTime() - now) / 60_000) + 8)
        : 10;
      next.etaUpdatedAt = nowIso();
      set({ myOrder: next });
      return;
    }

    // Mock runner progression — Phase 4 replaces this with Realtime events.
    const lastEvent = o.events[o.events.length - 1];
    const sinceLast = lastEvent ? now - new Date(lastEvent.at).getTime() : 0;
    const advance: Partial<Record<OrderStatus, { to: OrderStatus; label: (n: string) => string }>> =
      {
        confirmed: { to: 'picked_up', label: (n) => `${n} picked up your bag` },
        picked_up: { to: 'on_the_way', label: (n) => `${n} left for your drop spot` },
        on_the_way: { to: 'arrived', label: (n) => `${n} is at ${o.dropSpotText}` },
      };
    const step = advance[o.status];
    if (step && sinceLast >= DEMO_STEP_MS) {
      let next = { ...o, status: step.to };
      next = pushEvent(next, step.to, step.label(runnerFirst));
      if (step.to === 'arrived') next.etaMinutes = 0;
      set({ myOrder: next });
      return;
    }
    if (o.status === 'arrived' && sinceLast >= DEMO_STEP_MS) {
      let next = { ...o, status: 'delivered' as OrderStatus };
      next = pushEvent(next, 'delivered', `${runnerFirst} handed off your order`);
      set({ myOrder: next });
      return;
    }

    // ETA countdown, once per minute (§6.5).
    if (
      o.etaMinutes != null &&
      o.etaMinutes > 0 &&
      o.etaUpdatedAt &&
      now - new Date(o.etaUpdatedAt).getTime() >= 60_000 &&
      ['confirmed', 'picked_up', 'on_the_way'].includes(o.status)
    ) {
      set({ myOrder: { ...o, etaMinutes: o.etaMinutes - 1, etaUpdatedAt: nowIso() } });
    }
  },

  /**
   * Runner-side clock. Mirrors the orderer's cancel window (§6.4): once it
   * ends the order becomes `confirmed` and the runner is told to grab it.
   */
  tickRun: () => {
    const s = get();
    if (s.myRunOrders.length === 0) return;
    const now = Date.now();
    let changed = false;
    const next = s.myRunOrders.map((o) => {
      if (o.status !== 'pending' || now < new Date(o.cancelUntil).getTime()) return o;
      changed = true;
      return pushEvent(
        { ...o, status: 'confirmed' },
        'confirmed',
        `${o.ordererName} confirmed — grab this one`,
      ) as RunnerOrder;
    });
    if (changed) set({ myRunOrders: next });
  },

  rateRunner: (stars) => {
    const s = get();
    if (!s.myOrder) return;
    const done = { ...s.myOrder, rating: stars };
    set({ myOrder: null, pastOrders: [done, ...s.pastOrders] });
  },

  reportProblem: () => {
    const s = get();
    if (!s.myOrder) return;
    set({ myOrder: pushEvent(s.myOrder, 'problem', 'Problem reported — we will text you') });
  },

  postRun: (p) => {
    const s = get();
    const run: Run = {
      id: uid(),
      runner: s.me!,
      hallId: p.hallId,
      destinationId: p.destinationId,
      leaveAt: p.leaveAt,
      spotsTotal: p.spots,
      spotsLeft: p.spots,
      feeCents: p.feeCents,
      status: new Date(p.leaveAt).getTime() - Date.now() > 30 * 60_000 ? 'scheduled' : 'open',
    };
    // Mock orderers join over the next moments so the Active Run screen has work.
    const hall = hallById(p.hallId);
    const mockJoiners = [ANA, JAY].slice(0, Math.min(2, p.spots));
    const orders: RunnerOrder[] = mockJoiners.map((joiner, i) => {
      let o: Order = {
        id: uid(),
        runId: run.id,
        ordererId: joiner.id,
        hallId: p.hallId,
        restaurant: hall?.restaurants[i % Math.max(1, hall.restaurants.length)] ?? 'Station',
        t2gLast4: String(Math.floor(1000 + Math.random() * 9000)),
        orderName: joiner.firstName,
        dropSpotText:
          destinationById(p.destinationId)?.name === 'Geisel Library'
            ? `Geisel ${2 + i}F, Table ${10 + i}`
            : `${destinationById(p.destinationId)?.name ?? 'Lobby'}, spot ${i + 1}`,
        handoffCode: String(Math.floor(1000 + Math.random() * 9000)),
        status: i === 0 ? 'confirmed' : 'pending',
        cancelUntil: minsFromNow(i === 0 ? -1 : 1.5),
        feeCents: p.feeCents,
        etaMinutes: null,
        etaUpdatedAt: null,
        events: [],
      };
      o = pushEvent(o, o.status, `${joiner.firstName} joined your run`);
      return { ...o, ordererName: joiner.firstName };
    });
    // Seeded orders already occupy spots — keep the posted run from overbooking.
    const posted: Run = { ...run, spotsLeft: Math.max(0, p.spots - orders.length) };
    set({
      myRun: posted,
      myRunOrders: orders,
      runs: [posted, ...s.runs],
    });
    return posted;
  },

  runnerMarkPickedUp: (orderId) =>
    set((s) => ({
      myRunOrders: s.myRunOrders.map((o) =>
        o.id === orderId && (o.status === 'confirmed' || o.status === 'pending')
          ? (pushEvent({ ...o, status: 'picked_up' }, 'picked_up', 'Picked up') as RunnerOrder)
          : o,
      ),
    })),

  runnerMarkNotReady: (orderId) =>
    set((s) => ({
      myRunOrders: s.myRunOrders.map((o) =>
        o.id === orderId
          ? (pushEvent(o, 'not_ready', 'Not ready yet at pickup') as RunnerOrder)
          : o,
      ),
    })),

  runnerStartDelivering: () =>
    set((s) => ({
      myRun: s.myRun ? { ...s.myRun, status: 'delivering' } : s.myRun,
      myRunOrders: s.myRunOrders.map((o) =>
        o.status === 'picked_up'
          ? (pushEvent({ ...o, status: 'on_the_way' }, 'on_the_way', 'On the way') as RunnerOrder)
          : o,
      ),
    })),

  runnerDeliver: (orderId, code) => {
    const s = get();
    const order = s.myRunOrders.find((o) => o.id === orderId);
    if (!order || order.handoffCode !== code) return false;
    set({
      myRunOrders: s.myRunOrders.map((o) =>
        o.id === orderId
          ? (pushEvent({ ...o, status: 'delivered' }, 'delivered', 'Delivered') as RunnerOrder)
          : o,
      ),
      earningsCents: s.earningsCents + order.feeCents,
      deliveredCount: s.deliveredCount + 1,
    });
    return true;
  },

  endMyRun: () => {
    const s = get();
    set({
      myRun: null,
      myRunOrders: [],
      runs: s.runs.filter((r) => r.id !== s.myRun?.id),
    });
  },
}));
