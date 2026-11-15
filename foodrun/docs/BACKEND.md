# Backend setup (Phase 3)

The app runs with no backend at all. Every data path checks
`isBackendConfigured` in [`src/lib/supabase.ts`](../src/lib/supabase.ts); with
no credentials it uses the in-memory mock store and the demo sign-in where any
4-digit code works. That is deliberate — the demo has to survive a laptop with
no project attached.

Everything below switches it to a real Postgres with real auth.

## 1. Create the project

Supabase needs an account, which has to be made by a person, not by a script.
At <https://supabase.com> create a project and note two values from
**Project Settings → API**:

- Project URL
- `anon` public key

Both are safe in the client. The anon key grants nothing on its own: every
table is governed by the policies in
[`supabase/migrations/0002_rls.sql`](../supabase/migrations/0002_rls.sql).

## 2. Run the migrations

In the project's **SQL Editor**, run in order:

1. `supabase/migrations/0001_schema.sql` — tables, enums, constraints, triggers
2. `supabase/migrations/0002_rls.sql` — row level security and the realtime publication
3. `supabase/seed.sql` — halls, stations, destinations and drop spots

Or, with the Supabase CLI linked to the project:

```bash
supabase db push
supabase db execute --file supabase/seed.sql
```

The seed is upsert-shaped, so re-running it after HDH changes a station list
updates names and hours without touching runs that reference a hall.

## 3. Restrict sign-ups to UCSD

**Authentication → Providers → Email**: turn on email, turn off "Confirm
email" only if you want instant sign-in during a demo. The `@ucsd.edu`
restriction is enforced twice: by `isUcsdEmail` before the request, and by the
`profiles_ucsd_email_only` check constraint in the schema, which is the one
that actually counts.

## 4. Point the app at it

```bash
cp .env.example .env
```

Fill in both values. Expo inlines anything prefixed `EXPO_PUBLIC_` at build
time, so restart the dev server after editing:

```bash
npx expo start --clear
```

The sign-in screen tells you which mode it is in: with a project configured it
asks for the 6-digit code Supabase emailed, and the hint under the boxes
changes from "Demo build: any 4 digits work."

## What is wired, and what is not

Wired:

- **Schema** — every table, enum and constraint in §5, plus three triggers:
  `orders` stamps `updated_at`, every status change writes its own
  `order_events` row (so the timeline in §6.5 is a read, not something the
  client assembles), and `runs.spots_left` is recomputed from live orders
  rather than sent by a client, which is what stops two people taking the last
  spot.
- **RLS** — orderers see their own orders; runners see their run's orders
  through `orders_for_runner`, a view that omits `handoff_code`,
  `payment_intent_id` and `orderer_id` entirely. Postgres RLS filters rows,
  not columns, so the column restriction has to be a separate view.
- **Auth** — real email OTP, profile row created on first sign-in.
- **Local storage** — who is signed in, their name, their usual destination and
  recent drop spots survive closing the app.

Not yet wired: runs and orders still come from the mock store even when a
project is configured. The schema, the client and the generated types are in
place for it; swapping the store's reads and writes for queries is the
remaining work, followed by Realtime subscriptions for §6.5.
