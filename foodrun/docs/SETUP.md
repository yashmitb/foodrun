# FoodRun setup

Everything the app needs from an outside service, in the order it becomes
useful. Each section ends with the app still running, so you can stop after
any of them.

**Nothing here is required to run the demo.** With no services configured the
app uses mock data and a sign-in where any 4-digit code works. Each service
switches itself on when its keys appear.

| Service | What it buys you | Needed for |
|---|---|---|
| Node 22 | the app starting at all | everything |
| Supabase | real accounts, real runs and orders, live updates | Phases 3–5 |
| Custom SMTP | more than 3 sign-in emails an hour | a real demo |
| Stripe | holding and taking the delivery fee | Phase 6 |
| EAS | a build you can hand to someone | submission |

---

## 0. Node 22

Expo SDK 58 needs Node **≥ 22.13**. You have 20 as your default, which is why
the dev server printed `Node.js (v20.20.2) is outdated and unsupported`.

```bash
nvm use 22          # v22.22.2 is already installed
node -v             # must print v22.x
npx expo start
```

To stop remembering: `nvm alias default 22`.

---

## 1. Supabase

### Create the project

Go to <https://supabase.com>, create a project, pick a region near San Diego
(`us-west-1`). Save the database password somewhere; you will not be shown it
again.

From **Project Settings → API**, copy:

- **Project URL**
- **`anon` public** key

Both are safe to ship inside the app. The anon key grants nothing by itself —
every table is governed by the policies in `supabase/migrations/0002_rls.sql`.
The **`service_role`** key on that same page is the opposite: it bypasses
every policy. It never goes in the app, in `.env`, or in a commit.

### Create the tables

**SQL Editor → New query**, then run these three in order, one at a time:

1. `supabase/migrations/0001_schema.sql` — tables, enums, constraints, triggers
2. `supabase/migrations/0002_rls.sql` — row level security, realtime publication
3. `supabase/seed.sql` — the 7 dining halls, their stations, 10 destinations, drop spots

Each should end with `Success. No rows returned`.

With the CLI instead:

```bash
brew install supabase/tap/supabase
supabase link --project-ref <your-project-ref>
supabase db push
supabase db execute --file supabase/seed.sql
```

The seed upserts, so when HDH changes a station list you can edit
`foodrun-context/data/ucsd_dining.json`, regenerate, and re-run it without
disturbing existing runs.

### Point the app at it

```bash
cp .env.example .env
```

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

`.env` is gitignored. Expo inlines `EXPO_PUBLIC_*` at build time, so restart
with a clear cache:

```bash
npx expo start --clear
```

### Check it worked

The sign-in screen changes. In demo mode it says *"Demo build: any 4 digits
work."*; connected, it asks for the **6-digit** code Supabase emailed you.

---

## 2. Auth

Supabase email OTP is on by default, so section 1 already gave you working
sign-in. The settings worth knowing:

**Authentication → Sign In / Providers → Email**

- **Confirm email** — off is fine here. The one-time code already proves they
  own the address.
- **Secure email change** — leave on.

**Authentication → URL Configuration**

- **Site URL**: `foodrun://` (the app's scheme, from `app.json`)
- **Redirect URLs**: add `foodrun://*` and `exp://*`

Only needed if you add magic links later; the OTP path does not redirect.

### The UCSD restriction

Enforced twice, on purpose:

- `isUcsdEmail()` in `src/data/auth.ts`, so the user finds out before sending
- a `check` constraint on `profiles.ucsd_email`, which is the one that counts,
  because a UI rule is not a security boundary

Supabase itself will happily email a code to any address. If you want the
rejection to happen before the email is sent, add this in **SQL Editor**:

```sql
create or replace function public.reject_non_ucsd()
returns trigger language plpgsql security definer as $$
begin
  if new.email !~* '^[^@\s]+@ucsd\.edu$' then
    raise exception 'FoodRun is for UCSD students. Use your @ucsd.edu email.';
  end if;
  return new;
end;
$$;

create trigger reject_non_ucsd_signup
  before insert on auth.users
  for each row execute function public.reject_non_ucsd();
```

### Email limits

Supabase's built-in mailer sends **3 messages per hour per project** and is
explicitly not for production. That is fine for building and a disaster
during a live demo with a room full of people.

Before demoing to anyone, add real SMTP under **Project Settings → Auth →
SMTP Settings**. Resend has a free tier that works: create an account, verify
a domain (or use their sandbox address), and paste host, port `587`, user and
password. Then raise **Rate Limits → Emails per hour**.

---

## 3. Stripe

Not needed for the class demo — the app ships a fake payment service that
behaves correctly and moves no money. Read §6.4 before wiring the real one,
because the flow is unusual.

### Why it is not just "charge the card"

The fee is **authorised** when someone joins and **captured** only when the
runner enters the handoff code. Someone who cancels in the free window, or
whose runner never arrives, must never see a charge — so the money is held
and released, never taken and refunded. In Stripe that is a PaymentIntent
with `capture_method: 'manual'`.

### The key cannot live in the app

Capturing needs the Stripe **secret** key. A secret key in a React Native
bundle is a secret key on every phone that installs the app — anyone can
unzip an IPA. So the real implementation calls an Edge Function
(`supabase/functions/payments`) that holds the key server-side and checks,
per request, that the caller owns the order they are trying to settle.

### Setup

1. Create a Stripe account. Stay in **test mode** (the toggle, top right).
2. **Developers → API keys**: copy the **Secret key** (`sk_test_...`).
3. Give it to Supabase, never to the app:

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx
supabase functions deploy payments
```

4. Turn it on in `.env`:

```
EXPO_PUBLIC_ENABLE_STRIPE=true
```

Having a Supabase project is deliberately *not* enough to switch payments on.
You have to say so, because nobody wants a card charged during a class demo
by accident.

5. Test with Stripe's published test cards — `4242 4242 4242 4242`, any
   future expiry, any CVC. Those only work in test mode.

### Runner payouts

§6.8 wants runners paid out, which means **Stripe Connect Express**: each
runner gets a connected account, and the fee is transferred to them on
capture. That needs a Connect application and onboarding flow per runner. It
is real work and it is not started — `profiles.stripe_account_id` is the
column waiting for it.

---

## 4. Push notifications (§7)

Expo handles the plumbing, but a notification to a real device needs a build,
not Expo Go — Expo Go cannot receive remote push on iOS.

```bash
npx expo install expo-notifications
npx eas-cli@latest credentials      # creates the APNs key
```

Notifications are Phase 5 and are not implemented yet.

---

## 5. A build you can hand over

Expo Go is enough for everything above. For something installable:

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --profile preview --platform ios
```

`preview` produces an internal-distribution build for registered devices.
`eas build --profile production` plus `eas submit` goes to TestFlight, which
needs a paid Apple Developer account ($99/yr).

---

## Where the keys live

| Key | Where | In git? |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `.env` | no (gitignored) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `.env` | no, though it would be harmless |
| `service_role` key | nowhere in this repo | **never** |
| `STRIPE_SECRET_KEY` | Supabase function secrets | **never** |
| `EXPO_PUBLIC_ENABLE_STRIPE` | `.env` | no |

If a secret does end up committed, rotating it is the fix. Deleting the
commit is not — it stays in the history and in anyone's clone.

---

## Current state

Wired and working:

- Schema, RLS, seed, realtime publication
- Email OTP sign-in, profile created on first sign-in
- Session, name, usual destination and recent drop spots persisted locally
- `PaymentService` interface with a fake implementation; Stripe path written
  and deployable

Not wired yet:

- **Runs and orders still read from the mock store**, even with Supabase
  configured. The schema, client and types are in place; swapping the store's
  reads and writes for queries is the next slice.
- **Realtime subscriptions** for §6.5, which depend on the above.
- **Stripe Connect** payouts.
- **Push notifications**.
