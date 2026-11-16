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
