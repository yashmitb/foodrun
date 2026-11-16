-- FoodRun — complete database setup, in one paste.
--
-- Supabase dashboard → SQL Editor → New query → paste all of this → Run.
--
-- This is supabase/migrations/0001..0003 plus seed.sql concatenated in order.
-- 0003 deliberately drops and replaces several rules 0002 creates, so the
-- order matters and none of it is optional.
--
-- Every statement is safe to run twice, so if a run fails part-way you can
-- fix the cause and paste the whole thing again.



-- ====================================================================
-- 1 of 4 — schema: tables, constraints, triggers
-- ====================================================================

-- FoodRun schema (CLAUDE.md §5).
--
-- Naming and columns follow the spec exactly, with the constraints the spec
-- states in prose written down here instead: a Triton2Go reference is only
-- ever its last four digits, a handoff code is four digits, and a run's open
-- spots can never exceed the spots it was posted with.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- reference

create table if not exists public.halls (
  id         text primary key,
  name       text not null,
  college    text,
  triton2go  boolean not null default true,
  hours      jsonb not null default '{}'::jsonb,
  active     boolean not null default true
);

create table if not exists public.restaurants (
  id      uuid primary key default gen_random_uuid(),
  hall_id text not null references public.halls (id) on delete cascade,
  name    text not null,
  active  boolean not null default true,
  sort    int  not null default 0,
  unique (hall_id, name)
);

create table if not exists public.destinations (
  id   text primary key,
  name text not null,
  lat  double precision,
  lng  double precision
);

create table if not exists public.drop_spots (
  id             uuid primary key default gen_random_uuid(),
  destination_id text not null references public.destinations (id) on delete cascade,
  label          text not null,
  qr_code        text unique,
  -- So re-running the seed updates rather than duplicates.
  unique (destination_id, label)
);

-- ------------------------------------------------------------------ people

create table if not exists public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  name               text not null,
  ucsd_email         text not null unique,
  avatar_url         text,
  rating_avg         numeric(2, 1) not null default 5.0,
  rating_count       int not null default 0,
  stripe_customer_id text,
  stripe_account_id  text,
  created_at         timestamptz not null default now(),
  -- §2: only UCSD students. Enforced here as well as in the UI, because the
  -- UI is not a security boundary.
  constraint profiles_ucsd_email_only check (ucsd_email ~* '^[^@\s]+@ucsd\.edu$')
);

-- ------------------------------------------------------------- runs/orders

-- Guarded so the file can be re-run after a failure part-way through.
do $$ begin
  create type public.run_status as enum
    ('scheduled', 'open', 'picking_up', 'delivering', 'done', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_status as enum
    ('pending', 'confirmed', 'picked_up', 'on_the_way', 'arrived', 'delivered',
     'cancelled', 'problem');
exception when duplicate_object then null; end $$;

create table if not exists public.runs (
  id             uuid primary key default gen_random_uuid(),
  runner_id      uuid not null references public.profiles (id) on delete cascade,
  hall_id        text not null references public.halls (id),
  destination_id text not null references public.destinations (id),
  leave_at       timestamptz not null,
  spots_total    int not null check (spots_total between 1 and 5),
  spots_left     int not null check (spots_left >= 0),
  fee_cents      int not null check (fee_cents between 100 and 400),
  status         public.run_status not null default 'open',
  created_at     timestamptz not null default now(),
  constraint runs_spots_left_within_total check (spots_left <= spots_total)
);

create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  run_id            uuid not null references public.runs (id) on delete cascade,
  orderer_id        uuid not null references public.profiles (id) on delete cascade,
  hall_id           text not null references public.halls (id),
  restaurant_id     uuid references public.restaurants (id),
  -- §6.3 / feedback O1: the last four digits and nothing more. A char(4) of
  -- digits is the schema saying the same thing the sheet says.
  t2g_last4         char(4) not null check (t2g_last4 ~ '^[0-9]{4}$'),
  order_name        text,
  drop_spot_id      uuid references public.drop_spots (id),
  drop_spot_text    text not null,
  handoff_code      char(4) not null check (handoff_code ~ '^[0-9]{4}$'),
  status            public.order_status not null default 'pending',
  cancel_until      timestamptz not null,
  fee_cents         int not null,
  payment_intent_id text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- §8: one person cannot join the same run twice.
  unique (run_id, orderer_id)
);

create index if not exists orders_run_id_idx on public.orders (run_id);
create index if not exists orders_orderer_id_idx on public.orders (orderer_id);
create index if not exists runs_open_idx on public.runs (destination_id, leave_at)
  where status in ('open', 'scheduled');

create table if not exists public.order_events (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders (id) on delete cascade,
  status     public.order_status not null,
  note       text,
  actor_id   uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists order_events_order_id_idx on public.order_events (order_id, created_at);

create table if not exists public.ratings (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders (id) on delete cascade,
  from_id    uuid not null references public.profiles (id) on delete cascade,
  to_id      uuid not null references public.profiles (id) on delete cascade,
  stars      int not null check (stars between 1 and 5),
  note       text,
  created_at timestamptz not null default now(),
  unique (order_id, from_id)
);

do $$ begin
  create type public.report_reason as enum
    ('late', 'wrong_or_missing', 'cannot_find_runner', 'other');
exception when duplicate_object then null; end $$;

create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason      public.report_reason not null,
  note        text,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------------ triggers

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists orders_touch_updated_at on public.orders;
create trigger orders_touch_updated_at
  before update on public.orders
  for each row execute function public.touch_updated_at();

/**
 * Every status change writes its own audit row, so the timeline on My Order
 * (§6.5) is a read of order_events rather than something the client assembles
 * and can disagree about.
 */
create or replace function public.log_order_event()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.order_events (order_id, status, actor_id)
    values (new.id, new.status, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists orders_log_event on public.orders;
create trigger orders_log_event
  after insert or update of status on public.orders
  for each row execute function public.log_order_event();

/**
 * spots_left is derived, never sent by a client. Counting live orders on each
 * change is what stops two people joining the last spot at once; the check
 * constraint above then refuses to let it go negative.
 */
create or replace function public.sync_run_spots()
returns trigger language plpgsql as $$
declare
  target uuid := coalesce(new.run_id, old.run_id);
begin
  update public.runs r
     set spots_left = r.spots_total - (
           select count(*) from public.orders o
            where o.run_id = r.id
              and o.status not in ('cancelled')
         )
   where r.id = target;
  return null;
end;
$$;

drop trigger if exists orders_sync_run_spots on public.orders;
create trigger orders_sync_run_spots
  after insert or update of status or delete on public.orders
  for each row execute function public.sync_run_spots();



-- ====================================================================
-- 2 of 4 — first-pass access rules
-- ====================================================================

-- Row Level Security (CLAUDE.md §5).
--
-- The rule that matters: a runner may see what they need to carry a bag -
-- first name, restaurant, last four, drop spot - and nothing else. Nobody
-- but the orderer ever sees a handoff code, because the code is the only
-- thing that proves a delivery happened.
--
-- Postgres RLS filters rows, not columns, so the runner's view of an order is
-- a separate view (orders_for_runner) with the sensitive columns left out,
-- and the base table is readable only by the orderer.

alter table public.profiles      enable row level security;
alter table public.runs          enable row level security;
alter table public.orders        enable row level security;
alter table public.order_events  enable row level security;
alter table public.ratings       enable row level security;
alter table public.reports       enable row level security;
alter table public.halls         enable row level security;
alter table public.restaurants   enable row level security;
alter table public.destinations  enable row level security;
alter table public.drop_spots    enable row level security;

-- Reference data is public to signed-in students and writable by nobody.
drop policy if exists halls_read on public.halls;
create policy halls_read on public.halls for select to authenticated using (true);

drop policy if exists restaurants_read on public.restaurants;
create policy restaurants_read on public.restaurants for select to authenticated using (true);

drop policy if exists destinations_read on public.destinations;
create policy destinations_read on public.destinations for select to authenticated using (true);

drop policy if exists drop_spots_read on public.drop_spots;
create policy drop_spots_read on public.drop_spots for select to authenticated using (true);

-- ---------------------------------------------------------------- profiles

-- Names and ratings are visible to other students: you are about to hand a
-- stranger your food, and §6.2 puts their name and rating on the run card.
drop policy if exists profiles_read_all on public.profiles;
create policy profiles_read_all on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- -------------------------------------------------------------------- runs

drop policy if exists runs_read_all on public.runs;
create policy runs_read_all on public.runs
  for select to authenticated using (true);

drop policy if exists runs_insert_own on public.runs;
create policy runs_insert_own on public.runs
  for insert to authenticated with check (runner_id = auth.uid());

drop policy if exists runs_update_own on public.runs;
create policy runs_update_own on public.runs
  for update to authenticated using (runner_id = auth.uid()) with check (runner_id = auth.uid());

-- ------------------------------------------------------------------ orders

create or replace function public.is_runner_for_order(order_row public.orders)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.runs r
     where r.id = order_row.run_id and r.runner_id = auth.uid()
  );
$$;

-- The base table: only the person who placed the order.
drop policy if exists orders_read_own on public.orders;
create policy orders_read_own on public.orders
  for select to authenticated using (orderer_id = auth.uid());

drop policy if exists orders_insert_own on public.orders;
create policy orders_insert_own on public.orders
  for insert to authenticated with check (orderer_id = auth.uid());

-- An orderer may cancel inside the window; a runner may move the status along.
-- Neither may rewrite the order's identity, which the column grants below
-- restrict further.
drop policy if exists orders_update_own on public.orders;
create policy orders_update_own on public.orders
  for update to authenticated
  using (orderer_id = auth.uid())
  with check (orderer_id = auth.uid());

drop policy if exists orders_update_by_runner on public.orders;
create policy orders_update_by_runner on public.orders
  for update to authenticated
  using (public.is_runner_for_order(orders))
  with check (public.is_runner_for_order(orders));

/**
 * What a runner sees. No handoff_code, no payment_intent_id, no orderer id -
 * a first name is enough to match a bag to a face (§6.7).
 */
drop view if exists public.orders_for_runner;

create view public.orders_for_runner
with (security_invoker = true) as
  select o.id,
         o.run_id,
         split_part(p.name, ' ', 1) as orderer_first_name,
         r.name                     as restaurant,
         o.t2g_last4,
         o.order_name,
         o.drop_spot_text,
         o.status,
         o.cancel_until,
         o.fee_cents,
         o.created_at
    from public.orders o
    join public.profiles p on p.id = o.orderer_id
    left join public.restaurants r on r.id = o.restaurant_id
   where exists (
     select 1 from public.runs run
      where run.id = o.run_id and run.runner_id = auth.uid()
   );

grant select on public.orders_for_runner to authenticated;

-- The view is security_invoker, so it is still governed by orders_read_own
-- above. Give the runner a path to those rows without widening the table.
drop policy if exists orders_read_as_runner on public.orders;
create policy orders_read_as_runner on public.orders
  for select to authenticated using (public.is_runner_for_order(orders));

-- ------------------------------------------------------------ order_events

drop policy if exists order_events_read on public.order_events;
create policy order_events_read on public.order_events
  for select to authenticated using (
    exists (
      select 1 from public.orders o
       where o.id = order_events.order_id
         and (o.orderer_id = auth.uid() or public.is_runner_for_order(o))
    )
  );

-- Events are written by the trigger in 0001, never by a client.
revoke insert, update, delete on public.order_events from authenticated;

-- --------------------------------------------------------- ratings/reports

drop policy if exists ratings_read on public.ratings;
create policy ratings_read on public.ratings
  for select to authenticated using (from_id = auth.uid() or to_id = auth.uid());

drop policy if exists ratings_insert_own on public.ratings;
create policy ratings_insert_own on public.ratings
  for insert to authenticated with check (from_id = auth.uid());

drop policy if exists reports_read_own on public.reports;
create policy reports_read_own on public.reports
  for select to authenticated using (reporter_id = auth.uid());

drop policy if exists reports_insert_own on public.reports;
create policy reports_insert_own on public.reports
  for insert to authenticated with check (reporter_id = auth.uid());

-- ---------------------------------------------------------------- realtime

-- §6.5: the orderer's bar and timeline update from the runner's real actions.
do $$ begin
  alter publication supabase_realtime add table public.orders;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.order_events;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.runs;
exception when duplicate_object then null; end $$;



-- ====================================================================
-- 3 of 4 — hardening (undoes several things above; do not skip)
-- ====================================================================

-- Hardening for real users.
--
-- 0002 was written for a class demo and is not safe to put in front of
-- students. Four things were wrong with it, all of the same kind: the client
-- was trusted to send values it should never choose.
--
--   1. Runners could read the orders table directly, handoff_code included.
--      The whole point of the handoff code is that only the orderer has it;
--      a runner who can read it can mark a delivery they never made.
--   2. Anyone could UPDATE their own order, including its status and fee. An
--      orderer could set status = 'delivered' and a runner could do the same
--      without a code, which with Stripe wired means capturing a payment for
--      a bag that never moved.
--   3. Anyone could UPDATE their own profile, including rating_avg. A fresh
--      account could give itself 5.0 from 400 ratings.
--   4. Anyone could INSERT an order with any fee_cents, any cancel_until and
--      a handoff_code of their choosing, and rate or report orders they had
--      nothing to do with.
--
-- The fix is the same everywhere: clients may read, and may call functions
-- that perform one named transition after checking it is allowed. They may
-- not write these tables directly.

-- =====================================================================
-- 1. Stop the handoff code leaking to runners
-- =====================================================================

drop policy if exists orders_read_as_runner on public.orders;

/**
 * Rebuilt without security_invoker, so it does not need a policy on the base
 * table to be readable. The WHERE clause is now the only gate, which is the
 * point: it is one visible condition rather than a policy that happened to
 * also expose every other column.
 */
drop view if exists public.orders_for_runner;

create view public.orders_for_runner
with (security_invoker = false) as
  select o.id,
         o.run_id,
         split_part(p.name, ' ', 1) as orderer_first_name,
         r.name                     as restaurant,
         o.t2g_last4,
         o.order_name,
         o.drop_spot_text,
         o.status,
         o.cancel_until,
         o.fee_cents,
         o.created_at
    from public.orders o
    join public.profiles p on p.id = o.orderer_id
    left join public.restaurants r on r.id = o.restaurant_id
   where exists (
     select 1 from public.runs run
      where run.id = o.run_id and run.runner_id = auth.uid()
   );

revoke all on public.orders_for_runner from anon, authenticated;
grant select on public.orders_for_runner to authenticated;

-- =====================================================================
-- 2. Email addresses are not public
-- =====================================================================

drop policy if exists profiles_read_all on public.profiles;
drop policy if exists profiles_update_self on public.profiles;

-- You can read your own row in full.
drop policy if exists profiles_read_self on public.profiles;
create policy profiles_read_self on public.profiles
  for select to authenticated using (id = auth.uid());

/**
 * Everyone else sees a name and a rating, because §6.2 puts those on a run
 * card and you are about to hand this person your food. They do not see an
 * email address: 30,000 students' addresses behind one signed-in account is
 * a mailing list, and the app has no reason to hand it out.
 */
drop view if exists public.public_profiles;

create view public.public_profiles
with (security_invoker = false) as
  select id, name, avatar_url, rating_avg, rating_count
    from public.profiles;

revoke all on public.public_profiles from anon, authenticated;
grant select on public.public_profiles to authenticated;

/**
 * A profile update may change a display name and an avatar. It may not
 * change a rating, an email address, or a Stripe account id — those are set
 * by the system or by a verified sign-in.
 */
create or replace function public.guard_profile_update()
returns trigger language plpgsql as $$
begin
  /*
   * rate_order recomputes rating_avg itself and must be allowed through.
   * It announces itself with a transaction-local setting rather than being
   * exempted by role, because every one of these functions is SECURITY
   * DEFINER and a blanket role exemption would exempt all of them.
   */
  if current_setting('foodrun.system_update', true) = 'on' then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.ucsd_email is distinct from old.ucsd_email
     or new.rating_avg is distinct from old.rating_avg
     or new.rating_count is distinct from old.rating_count
     or new.stripe_customer_id is distinct from old.stripe_customer_id
     or new.stripe_account_id is distinct from old.stripe_account_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Only name and avatar_url can be changed here.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_update on public.profiles;
create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- =====================================================================
-- 3. Orders and runs are written only through functions
-- =====================================================================

drop policy if exists orders_insert_own on public.orders;
drop policy if exists orders_update_own on public.orders;
drop policy if exists orders_update_by_runner on public.orders;
drop policy if exists runs_insert_own on public.runs;
drop policy if exists runs_update_own on public.runs;

revoke insert, update, delete on public.orders from authenticated;
revoke insert, update, delete on public.runs   from authenticated;
revoke insert, update, delete on public.ratings from authenticated;
revoke insert, update, delete on public.reports from authenticated;

-- Reads stay as they were: your own orders, and any run.
-- (orders_read_own and runs_read_all survive from 0002.)

/**
 * A four digit code from the CSPRNG.
 *
 * Rejection sampling rather than a modulo: 65536 is not a multiple of 10000,
 * so `% 10000` makes codes under 5536 more likely than the rest. The bias is
 * small and this is the one secret that proves a delivery happened, so it is
 * not worth having at all. Draw 14 bits and discard anything over 9999.
 */
create or replace function public.new_handoff_code()
returns char(4) language plpgsql volatile as $$
declare
  b bytea;
  n int;
begin
  loop
    b := gen_random_bytes(2);
    n := ((get_byte(b, 0) << 8) | get_byte(b, 1)) & 16383;
    exit when n < 10000;
  end loop;
  return lpad(n::text, 4, '0')::char(4);
end;
$$;

/**
 * §6.6 — post a run.
 *
 * The runner names the hall, destination, time, spots and fee; everything
 * else is computed. The fee is clamped to the range the UI offers, because a
 * client is free to send any number it likes.
 */
create or replace function public.post_run(
  p_hall_id text,
  p_destination_id text,
  p_leave_at timestamptz,
  p_spots int,
  p_fee_cents int
) returns public.runs
language plpgsql security definer set search_path = public as $$
declare
  result public.runs;
begin
  if auth.uid() is null then raise exception 'Not signed in.'; end if;
  if p_spots < 1 or p_spots > 5 then raise exception 'Spots must be 1 to 5.'; end if;
  if p_fee_cents < 100 or p_fee_cents > 400 then raise exception 'Fee must be $1 to $4.'; end if;
  if p_leave_at < now() - interval '5 minutes' then raise exception 'That time has passed.'; end if;
  if p_leave_at > now() + interval '2 days' then raise exception 'Too far ahead.'; end if;
  if not exists (select 1 from public.halls where id = p_hall_id and active) then
    raise exception 'That dining hall is not available.';
  end if;

  -- One live run at a time: a runner cannot be walking two routes at once,
  -- and §6.7's screen assumes one.
  if exists (
    select 1 from public.runs
     where runner_id = auth.uid() and status in ('scheduled', 'open', 'picking_up', 'delivering')
  ) then
    raise exception 'You already have a run in progress.';
  end if;

  insert into public.runs (runner_id, hall_id, destination_id, leave_at,
                           spots_total, spots_left, fee_cents, status)
  values (auth.uid(), p_hall_id, p_destination_id, p_leave_at,
          p_spots, p_spots, p_fee_cents,
          -- Cast explicitly: a CASE yields text, and status is an enum.
          (case when p_leave_at > now() + interval '45 minutes'
                then 'scheduled' else 'open' end)::public.run_status)
  returning * into result;

  return result;
end;
$$;

/**
 * §6.3 / §6.4 — join a run.
 *
 * fee_cents comes from the run, not the caller. cancel_until is computed
 * here. The handoff code is generated here and returned to the orderer only,
 * via their own row.
 *
 * The `for update` lock on the run is what makes the last spot safe: two
 * people joining at the same instant serialise, and the second sees zero.
 */
create or replace function public.join_run(
  p_run_id uuid,
  p_restaurant_id uuid,
  p_t2g_last4 text,
  p_order_name text,
  p_drop_spot_text text,
  p_drop_spot_id uuid default null
) returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  the_run public.runs;
  result  public.orders;
begin
  if auth.uid() is null then raise exception 'Not signed in.'; end if;
  if p_t2g_last4 !~ '^[0-9]{4}$' then raise exception 'Order number must be 4 digits.'; end if;
  if coalesce(trim(p_drop_spot_text), '') = '' then raise exception 'Set your drop spot.'; end if;
  if length(p_drop_spot_text) > 120 then raise exception 'That drop spot is too long.'; end if;
  if length(coalesce(p_order_name, '')) > 80 then raise exception 'That name is too long.'; end if;

  select * into the_run from public.runs where id = p_run_id for update;
  if not found then raise exception 'That run is gone.'; end if;
  if the_run.status not in ('scheduled', 'open') then raise exception 'That run has left.'; end if;
  if the_run.spots_left <= 0 then raise exception 'This run just filled up.'; end if;
  if the_run.runner_id = auth.uid() then raise exception 'That is your own run.'; end if;

  -- §8 and the Find banner: one order in flight at a time.
  if exists (
    select 1 from public.orders
     where orderer_id = auth.uid()
       and status not in ('delivered', 'cancelled')
  ) then
    raise exception 'You already have an order in flight.';
  end if;

  -- §6.3: the order must come from the hall the run starts at.
  if p_restaurant_id is not null and not exists (
    select 1 from public.restaurants
     where id = p_restaurant_id and hall_id = the_run.hall_id and active
  ) then
    raise exception 'Pick a station at that dining hall.';
  end if;

  insert into public.orders (
    run_id, orderer_id, hall_id, restaurant_id, t2g_last4, order_name,
    drop_spot_id, drop_spot_text, handoff_code, status, cancel_until, fee_cents
  ) values (
    the_run.id, auth.uid(), the_run.hall_id, p_restaurant_id, p_t2g_last4,
    nullif(trim(p_order_name), ''), p_drop_spot_id, trim(p_drop_spot_text),
    public.new_handoff_code(), 'pending'::public.order_status,
    least(now() + interval '2 minutes', the_run.leave_at), the_run.fee_cents
  ) returning * into result;

  return result;
end;
$$;

/** §6.4 — the cancel window closing is a read, not a scheduled job. */
create or replace function public.settle_cancel_windows()
returns void language sql security definer set search_path = public as $$
  update public.orders
     set status = 'confirmed'
   where status = 'pending' and cancel_until <= now();
$$;

/** §6.4 — cancel. Allowed until the runner has the bag, never after. */
create or replace function public.cancel_order(p_order_id uuid)
returns public.orders
language plpgsql security definer set search_path = public as $$
declare result public.orders;
begin
  update public.orders
     set status = 'cancelled'
   where id = p_order_id
     and orderer_id = auth.uid()
     and status in ('pending', 'confirmed')
  returning * into result;
  if not found then raise exception 'That order can no longer be cancelled.'; end if;
  return result;
end;
$$;

/** §6.7 — runner transitions, each checking it is this run's runner. */
create or replace function public.runner_set_status(p_order_id uuid, p_status public.order_status)
returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  cur    public.orders;
  result public.orders;
begin
  select o.* into cur
    from public.orders o
    join public.runs r on r.id = o.run_id
   where o.id = p_order_id and r.runner_id = auth.uid()
   for update of o;
  if not found then raise exception 'Not your order.'; end if;

  -- Only these moves, only in this order. 'delivered' is absent on purpose:
  -- it is reachable solely through runner_deliver, which needs the code.
  if not (
    (cur.status = 'confirmed'  and p_status = 'picked_up')  or
    (cur.status = 'picked_up'  and p_status = 'on_the_way') or
    (cur.status = 'on_the_way' and p_status = 'arrived')    or
    (cur.status in ('confirmed', 'picked_up', 'on_the_way', 'arrived')
       and p_status = 'problem')
  ) then
    raise exception 'That is not a move this order can make.';
  end if;

  update public.orders set status = p_status where id = p_order_id returning * into result;
  return result;
end;
$$;

/**
 * §6.7 — deliver. The only path to 'delivered', and it needs the four digits
 * the orderer is holding up on their screen.
 *
 * Wrong guesses are counted, because four digits is 10,000 possibilities and
 * an unlimited guess rate turns that into no protection at all.
 */
create table if not exists public.handoff_attempts (
  order_id   uuid not null references public.orders (id) on delete cascade,
  actor_id   uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists handoff_attempts_idx
  on public.handoff_attempts (order_id, created_at desc);
alter table public.handoff_attempts enable row level security;

create or replace function public.runner_deliver(p_order_id uuid, p_code text)
returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  cur    public.orders;
  result public.orders;
  recent  int;
begin
  select o.* into cur
    from public.orders o
    join public.runs r on r.id = o.run_id
   where o.id = p_order_id and r.runner_id = auth.uid()
   for update of o;
  if not found then raise exception 'Not your order.'; end if;
  if cur.status = 'delivered' then return current; end if;
  if cur.status not in ('picked_up', 'on_the_way', 'arrived') then
    raise exception 'Pick the bag up first.';
  end if;

  select count(*) into recent
    from public.handoff_attempts
   where order_id = p_order_id and created_at > now() - interval '10 minutes';
  if recent >= 8 then
    raise exception 'Too many wrong codes. Ask them to show it again in a few minutes.';
  end if;

  if cur.handoff_code <> p_code then
    insert into public.handoff_attempts (order_id, actor_id) values (p_order_id, auth.uid());
    raise exception 'That code did not match.';
  end if;

  update public.orders set status = 'delivered' where id = p_order_id returning * into result;
  delete from public.handoff_attempts where order_id = p_order_id;
  return result;
end;
$$;

/** §6.5 — rate, once, only an order you were part of, only once delivered. */
create or replace function public.rate_order(p_order_id uuid, p_stars int, p_note text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  the_order public.orders;
  runner    uuid;
  target    uuid;
begin
  if p_stars < 1 or p_stars > 5 then raise exception 'Stars must be 1 to 5.'; end if;
  -- Two selects, not one. Postgres refuses to put a record variable in a
  -- multi-item INTO list, which is what "record variable cannot be part of
  -- multiple-item INTO list" was telling us.
  select o.* into the_order from public.orders o where o.id = p_order_id;
  if not found then raise exception 'No such order.'; end if;
  select r.runner_id into runner from public.runs r where r.id = the_order.run_id;
  if the_order.status <> 'delivered' then raise exception 'Not delivered yet.'; end if;

  if auth.uid() = the_order.orderer_id then target := runner;
  elsif auth.uid() = runner then target := the_order.orderer_id;
  else raise exception 'You were not part of that order.';
  end if;

  insert into public.ratings (order_id, from_id, to_id, stars, note)
  values (p_order_id, auth.uid(), target, p_stars, left(coalesce(p_note, ''), 500))
  on conflict (order_id, from_id) do nothing;

  -- Ratings are a derived number, which is why clients cannot write one.
  -- Local to this transaction, so it cannot leak into the next statement.
  perform set_config('foodrun.system_update', 'on', true);
  update public.profiles p
     set rating_avg = sub.avg_stars, rating_count = sub.n
    from (select round(avg(stars)::numeric, 1) as avg_stars, count(*) as n
            from public.ratings where to_id = target) sub
   where p.id = target;
  perform set_config('foodrun.system_update', 'off', true);
end;
$$;

/** §6.5 — report a problem. */
create or replace function public.report_order(
  p_order_id uuid, p_reason public.report_reason, p_note text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.orders o
      join public.runs r on r.id = o.run_id
     where o.id = p_order_id and (o.orderer_id = auth.uid() or r.runner_id = auth.uid())
  ) then
    raise exception 'You were not part of that order.';
  end if;
  insert into public.reports (order_id, reporter_id, reason, note)
  values (p_order_id, auth.uid(), p_reason, left(coalesce(p_note, ''), 1000));
end;
$$;

-- Functions are the only write path, so they are the only thing granted.
revoke all on function public.post_run(text, text, timestamptz, int, int) from public;
revoke all on function public.join_run(uuid, uuid, text, text, text, uuid) from public;
revoke all on function public.cancel_order(uuid) from public;
revoke all on function public.runner_set_status(uuid, public.order_status) from public;
revoke all on function public.runner_deliver(uuid, text) from public;
revoke all on function public.rate_order(uuid, int, text) from public;
revoke all on function public.report_order(uuid, public.report_reason, text) from public;
revoke all on function public.settle_cancel_windows() from public;
revoke all on function public.new_handoff_code() from public;

grant execute on function public.post_run(text, text, timestamptz, int, int) to authenticated;
grant execute on function public.join_run(uuid, uuid, text, text, text, uuid) to authenticated;
grant execute on function public.cancel_order(uuid) to authenticated;
grant execute on function public.runner_set_status(uuid, public.order_status) to authenticated;
grant execute on function public.runner_deliver(uuid, text) to authenticated;
grant execute on function public.rate_order(uuid, int, text) to authenticated;
grant execute on function public.report_order(uuid, public.report_reason, text) to authenticated;
grant execute on function public.settle_cancel_windows() to authenticated;

-- =====================================================================
-- 4. Only UCSD, enforced before an email is ever sent
-- =====================================================================

create or replace function public.reject_non_ucsd()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is null or new.email !~* '^[^@\s]+@ucsd\.edu$' then
    raise exception 'FoodRun is for UCSD students. Use your @ucsd.edu email.';
  end if;
  return new;
end;
$$;

drop trigger if exists reject_non_ucsd_signup on auth.users;
create trigger reject_non_ucsd_signup
  before insert on auth.users
  for each row execute function public.reject_non_ucsd();



-- ====================================================================
-- 4 of 4 — UCSD halls, stations, destinations, drop spots
-- ====================================================================

-- Seed: UCSD halls, stations and destinations.
--
-- Generated from foodrun-context/data/ucsd_dining.json, which carries
-- verify flags for the facts that still need checking against HDH. Station
-- lists change every year, so this is upsert-shaped: re-running it updates
-- names and hours without disturbing runs that already reference a hall.

insert into public.halls (id, name, college, triton2go, hours, active) values
  ('64-degrees', '64 Degrees', 'Revelle', true, '{"sun": "9am-9pm", "mon": "7am-11pm", "tue": "7am-11pm", "wed": "7am-11pm", "thu": "7am-11pm", "fri": "7am-9pm", "sat": "9am-9pm"}'::jsonb, true),
  ('pines', 'Pines', 'Muir', true, '{"sun": "9am-11pm", "mon": "7am-11pm", "tue": "7am-11pm", "wed": "7am-11pm", "thu": "7am-11pm", "fri": "7am-9pm", "sat": "9am-9pm"}'::jsonb, true),
  ('canyon-vista', 'Canyon Vista', 'Warren', true, '{"sun": "9am-9pm", "mon": "7am-9pm", "tue": "7am-9pm", "wed": "7am-9pm", "thu": "7am-9pm", "fri": "7am-9pm", "sat": "9am-9pm"}'::jsonb, true),
  ('ventanas', 'Ventanas', 'Eighth', true, '{"sun": "9am-9pm", "mon": "8am-9pm", "tue": "8am-9pm", "wed": "8am-9pm", "thu": "8am-9pm", "fri": "8am-9pm", "sat": "9am-9pm"}'::jsonb, true),
  ('oceanview', 'OceanView', 'Marshall', true, '{"sun": "closed", "mon": "8am-9pm", "tue": "8am-9pm", "wed": "8am-9pm", "thu": "8am-9pm", "fri": "8am-3pm", "sat": "closed"}'::jsonb, true),
  ('sixth', 'Restaurants at Sixth', 'Sixth', true, '{"sun": "closed", "mon": "8am-9pm", "tue": "8am-9pm", "wed": "8am-9pm", "thu": "8am-9pm", "fri": "8am-9pm", "sat": "closed"}'::jsonb, true),
  ('foodworx', 'Foodworx', null, true, '{"sun": "closed", "mon": "9am-8pm", "tue": "9am-8pm", "wed": "9am-8pm", "thu": "9am-8pm", "fri": "9am-8pm", "sat": "closed"}'::jsonb, true)
on conflict (id) do update set
  name = excluded.name,
  college = excluded.college,
  triton2go = excluded.triton2go,
  hours = excluded.hours,
  active = excluded.active;

insert into public.restaurants (hall_id, name, sort) values
  ('64-degrees', 'Garden Bar', 0),
  ('64-degrees', 'Taqueria', 1),
  ('64-degrees', 'Triton Grill', 2),
  ('64-degrees', 'Wok This Way', 3),
  ('pines', 'Char', 0),
  ('pines', 'Heat', 1),
  ('pines', 'Current', 2),
  ('pines', 'Breeze', 3),
  ('pines', 'Street Eats', 4),
  ('pines', 'Pacific Coast Hwy', 5),
  ('pines', 'Morning Fog', 6),
  ('pines', 'Slice at Pines', 7),
  ('canyon-vista', '360', 0),
  ('canyon-vista', 'Fresh', 1),
  ('canyon-vista', 'Fusion Grill', 2),
  ('ventanas', 'Soul', 0),
  ('ventanas', 'Tandoor', 1),
  ('ventanas', 'Vibe', 2),
  ('ventanas', 'Journey', 3),
  ('ventanas', 'HaPi', 4),
  ('ventanas', 'Kaldi', 5),
  ('oceanview', 'Journey Bowls', 0),
  ('oceanview', 'Tandoor', 1),
  ('oceanview', 'Vibe', 2),
  ('oceanview', 'Soul', 3),
  ('oceanview', 'Burgers', 4),
  ('oceanview', 'Build Your Own', 5)
on conflict (hall_id, name) do update set sort = excluded.sort, active = true;

insert into public.destinations (id, name) values
  ('geisel', 'Geisel Library'),
  ('price-center', 'Price Center'),
  ('biomed-library', 'Biomedical Library'),
  ('cse-building', 'CSE Building'),
  ('revelle-res', 'Revelle residence lobbies'),
  ('muir-res', 'Muir residence lobbies'),
  ('warren-res', 'Warren residence lobbies'),
  ('marshall-res', 'Marshall residence lobbies'),
  ('sixth-res', 'Sixth residence lobbies'),
  ('eighth-res', 'Eighth residence lobbies')
on conflict (id) do update set name = excluded.name;

-- A few real drop spots so the "No sticker? Pick a spot" fallback (§6.3)
-- has something to offer before any QR stickers exist.
insert into public.drop_spots (destination_id, label) values
  ('geisel', 'Geisel 1F, Lobby'),
  ('geisel', 'Geisel 2F, Table 14'),
  ('geisel', 'Geisel 8F, East window'),
  ('price-center', 'Price Center, Lobby'),
  ('price-center', 'Price Center, Front desk'),
  ('biomed-library', 'Biomedical Library, Lobby'),
  ('biomed-library', 'Biomedical Library, Front desk'),
  ('cse-building', 'CSE Building, Lobby'),
  ('cse-building', 'CSE Building, Front desk'),
  ('revelle-res', 'Revelle residence lobbies, Lobby'),
  ('revelle-res', 'Revelle residence lobbies, Front desk'),
  ('muir-res', 'Muir residence lobbies, Lobby'),
  ('muir-res', 'Muir residence lobbies, Front desk'),
  ('warren-res', 'Warren residence lobbies, Lobby'),
  ('warren-res', 'Warren residence lobbies, Front desk'),
  ('marshall-res', 'Marshall residence lobbies, Lobby'),
  ('marshall-res', 'Marshall residence lobbies, Front desk'),
  ('sixth-res', 'Sixth residence lobbies, Lobby'),
  ('sixth-res', 'Sixth residence lobbies, Front desk'),
  ('eighth-res', 'Eighth residence lobbies, Lobby'),
  ('eighth-res', 'Eighth residence lobbies, Front desk')
on conflict (destination_id, label) do nothing;
