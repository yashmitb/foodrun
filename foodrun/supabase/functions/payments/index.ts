// Supabase Edge Function: the only place the Stripe secret key exists.
//
// Deployed with:  supabase functions deploy payments
// Secrets set with:  supabase secrets set STRIPE_SECRET_KEY=sk_test_...
//
// Runs on Deno, not in the app bundle. The import URLs below are correct for
// Edge Functions and will not resolve in the React Native project — that is
// expected; this file is deployed, not bundled.

import Stripe from 'https://esm.sh/stripe@18.5.0?target=denonext';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2025-08-27.basil',
  httpClient: Stripe.createFetchHttpClient(),
});

type Body = { action: 'authorize' | 'capture' | 'release'; orderId: string; amountCents?: number };

Deno.serve(async (req) => {
  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: 'Not signed in.' }, 401);

  // A client-scoped client: every query below runs as the caller, under the
  // same RLS policies the app obeys. Using the service key here would mean
  // any signed-in student could capture anyone's order.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } },
  );

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return json({ error: 'Not signed in.' }, 401);

  const body = (await req.json()) as Body;
  const { action, orderId } = body;
  if (!orderId) return json({ error: 'Missing orderId.' }, 400);

  try {
    if (action === 'authorize') {
      // Only the person placing the order may authorise its fee, and the
      // amount comes from the run, not from the request: a client that could
      // name its own price would name zero.
      const { data: order, error } = await supabase
        .from('orders')
        .select('id, fee_cents, orderer_id, payment_intent_id')
        .eq('id', orderId)
        .single();
      if (error || !order) return json({ error: 'Order not found.' }, 404);
      if (order.orderer_id !== user.id) return json({ error: 'Not your order.' }, 403);
      if (order.payment_intent_id) {
        return json({ id: order.payment_intent_id, amountCents: order.fee_cents });
      }

      const intent = await stripe.paymentIntents.create({
        amount: order.fee_cents,
        currency: 'usd',
        // Hold, do not take. §6.4: a free cancel window means the money has
        // not moved yet.
        capture_method: 'manual',
        metadata: { order_id: orderId, orderer_id: user.id },
      });

      await supabase.from('orders').update({ payment_intent_id: intent.id }).eq('id', orderId);
      return json({ id: intent.id, amountCents: order.fee_cents });
    }

    // Capture and release both read through orders_for_runner, which only
    // returns rows on a run this user is actually running (§5).
    const { data: order, error } = await supabase
      .from('orders')
      .select('id, fee_cents, status, payment_intent_id')
      .eq('id', orderId)
      .single();
    if (error || !order?.payment_intent_id) return json({ error: 'Nothing to settle.' }, 404);

    if (action === 'capture') {
      // The handoff code is what proves delivery, and the app only moves an
      // order to 'delivered' when it matched. Trusting that status here is
      // what keeps the code out of this function.
      if (order.status !== 'delivered') {
        return json({ error: 'Not delivered yet.' }, 409);
      }
      const intent = await stripe.paymentIntents.capture(order.payment_intent_id);
      return json({ id: intent.id, amountCents: intent.amount_received });
    }

    if (action === 'release') {
      await stripe.paymentIntents.cancel(order.payment_intent_id);
      return json(null);
    }

    return json({ error: 'Unknown action.' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Payment failed.' }, 500);
  }
});

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
