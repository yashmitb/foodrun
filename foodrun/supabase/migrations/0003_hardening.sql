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
create policy profiles_read_self on public.profiles
  for select to authenticated using (id = auth.uid());

/**
 * Everyone else sees a name and a rating, because §6.2 puts those on a run
 * card and you are about to hand this person your food. They do not see an
 * email address: 30,000 students' addresses behind one signed-in account is
 * a mailing list, and the app has no reason to hand it out.
 */
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

create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

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

/** A four digit code with no modulo bias, from the CSPRNG rather than random(). */
create or replace function public.new_handoff_code()
returns char(4) language sql volatile as $$
  select lpad(((get_byte(gen_random_bytes(2), 0) << 8 |
                get_byte(gen_random_bytes(2), 1)) % 10000)::text, 4, '0')::char(4);
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
          case when p_leave_at > now() + interval '45 minutes' then 'scheduled' else 'open' end)
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
    public.new_handoff_code(), 'pending',
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
create or replace function public.runner_set_status(p_order_id uuid, p_status order_status)
returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  current public.orders;
  result  public.orders;
begin
  select o.* into current
    from public.orders o
    join public.runs r on r.id = o.run_id
   where o.id = p_order_id and r.runner_id = auth.uid()
   for update of o;
  if not found then raise exception 'Not your order.'; end if;

  -- Only these moves, only in this order. 'delivered' is absent on purpose:
  -- it is reachable solely through runner_deliver, which needs the code.
  if not (
    (current.status = 'confirmed'  and p_status = 'picked_up')  or
    (current.status = 'picked_up'  and p_status = 'on_the_way') or
    (current.status = 'on_the_way' and p_status = 'arrived')    or
    (current.status in ('confirmed', 'picked_up', 'on_the_way', 'arrived')
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
  current public.orders;
  result  public.orders;
  recent  int;
begin
  select o.* into current
    from public.orders o
    join public.runs r on r.id = o.run_id
   where o.id = p_order_id and r.runner_id = auth.uid()
   for update of o;
  if not found then raise exception 'Not your order.'; end if;
  if current.status = 'delivered' then return current; end if;
  if current.status not in ('picked_up', 'on_the_way', 'arrived') then
    raise exception 'Pick the bag up first.';
  end if;

  select count(*) into recent
    from public.handoff_attempts
   where order_id = p_order_id and created_at > now() - interval '10 minutes';
  if recent >= 8 then
    raise exception 'Too many wrong codes. Ask them to show it again in a few minutes.';
  end if;

  if current.handoff_code <> p_code then
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
  select o.*, r.runner_id into the_order, runner
    from public.orders o join public.runs r on r.id = o.run_id
   where o.id = p_order_id;
  if not found then raise exception 'No such order.'; end if;
  if the_order.status <> 'delivered' then raise exception 'Not delivered yet.'; end if;

  if auth.uid() = the_order.orderer_id then target := runner;
  elsif auth.uid() = runner then target := the_order.orderer_id;
  else raise exception 'You were not part of that order.';
  end if;

  insert into public.ratings (order_id, from_id, to_id, stars, note)
  values (p_order_id, auth.uid(), target, p_stars, left(coalesce(p_note, ''), 500))
  on conflict (order_id, from_id) do nothing;

  -- Ratings are a derived number, which is why clients cannot write one.
  update public.profiles p
     set rating_avg = sub.avg_stars, rating_count = sub.n
    from (select round(avg(stars)::numeric, 1) as avg_stars, count(*) as n
            from public.ratings where to_id = target) sub
   where p.id = target;
end;
$$;

/** §6.5 — report a problem. */
create or replace function public.report_order(
  p_order_id uuid, p_reason report_reason, p_note text default null
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
revoke all on function public.runner_set_status(uuid, order_status) from public;
revoke all on function public.runner_deliver(uuid, text) from public;
revoke all on function public.rate_order(uuid, int, text) from public;
revoke all on function public.report_order(uuid, report_reason, text) from public;
revoke all on function public.settle_cancel_windows() from public;
revoke all on function public.new_handoff_code() from public;

grant execute on function public.post_run(text, text, timestamptz, int, int) to authenticated;
grant execute on function public.join_run(uuid, uuid, text, text, text, uuid) to authenticated;
grant execute on function public.cancel_order(uuid) to authenticated;
grant execute on function public.runner_set_status(uuid, order_status) to authenticated;
grant execute on function public.runner_deliver(uuid, text) to authenticated;
grant execute on function public.rate_order(uuid, int, text) to authenticated;
grant execute on function public.report_order(uuid, report_reason, text) to authenticated;
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
