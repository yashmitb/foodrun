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
