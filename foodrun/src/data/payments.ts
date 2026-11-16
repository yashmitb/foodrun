import { isBackendConfigured, requireSupabase } from '@/lib/supabase';

/**
 * §2 — payments behind an interface, with a fake implementation for the demo.
 *
 * The shape of this is dictated by §6.4 and §6.7, not by Stripe: the fee is
 * *authorised* when someone joins a run and only *captured* once the runner
 * has entered the handoff code. A student who cancels inside the free window,
 * or whose runner never shows, must never see a charge — so the money is held
 * and released, never taken and refunded.
 *
 * In Stripe's terms that is a PaymentIntent created with
 * `capture_method: 'manual'`, captured on delivery and cancelled otherwise.
 * None of that can happen in the app: capturing requires the secret key, and
 * a secret key in a React Native bundle is a secret key on every phone that
 * installs it. The real implementation therefore calls an Edge Function
 * (supabase/functions/payments) which holds the key server-side.
 */

export type Authorization = {
  /** Stripe PaymentIntent id, or a fake one in demo mode. */
  id: string;
  amountCents: number;
};

export type PaymentResult<T> = { ok: true; value: T } | { ok: false; message: string };

export interface PaymentService {
  /** Hold the fee when an order is placed. Money does not move yet. */
  authorize(orderId: string, amountCents: number): Promise<PaymentResult<Authorization>>;
  /** Take the held fee. Called once a handoff code has matched. */
  capture(orderId: string): Promise<PaymentResult<Authorization>>;
  /** Release the hold. Cancellation, a cancelled run, a reported problem. */
  release(orderId: string): Promise<PaymentResult<null>>;
}

/** What the demo uses. No network, no keys, deterministic ids. */
export const fakePayments: PaymentService = {
  async authorize(orderId, amountCents) {
    return { ok: true, value: { id: `demo_pi_${orderId}`, amountCents } };
  },
  async capture(orderId) {
    return { ok: true, value: { id: `demo_pi_${orderId}`, amountCents: 0 } };
  },
  async release() {
    return { ok: true, value: null };
  },
};

/**
 * Talks to the Edge Function, which talks to Stripe. The caller's Supabase
 * JWT goes along automatically, so the function can check that the person
 * asking to capture an order is actually that order's runner.
 */
export const stripePayments: PaymentService = {
  authorize: (orderId, amountCents) => call('authorize', { orderId, amountCents }),
  capture: (orderId) => call('capture', { orderId }),
  release: (orderId) => call('release', { orderId }),
};

async function call<T>(action: string, body: Record<string, unknown>): Promise<PaymentResult<T>> {
  try {
    const { data, error } = await requireSupabase().functions.invoke('payments', {
      body: { action, ...body },
    });
    if (error) return { ok: false, message: error.message };
    return { ok: true, value: data as T };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Payment failed.' };
  }
}

/**
 * Stripe only turns on when there is a backend to hold the key *and* someone
 * has said they want it. Having a Supabase project is not consent to start
 * charging cards during a class demo.
 */
export const payments: PaymentService =
  isBackendConfigured && process.env.EXPO_PUBLIC_ENABLE_STRIPE === 'true'
    ? stripePayments
    : fakePayments;

export const paymentsMode: 'stripe' | 'demo' = payments === stripePayments ? 'stripe' : 'demo';
