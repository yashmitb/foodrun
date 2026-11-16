\pset tuples_only on
\pset format unaligned
set role authenticated;

create or replace function pg_temp.blocked(sql text) returns text language plpgsql as $$
begin execute sql; return 'FAIL - allowed'; exception when others then return 'ok (' || left(sqlerrm, 44) || ')'; end;
$$;

select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);

select 'A1 runner marks delivered    : ' || pg_temp.blocked(
  $q$ select public.runner_set_status((select id from public.orders_for_runner limit 1), 'delivered') $q$);

select 'A2 runner UPDATEs order row  : ' || pg_temp.blocked(
  $q$ update public.orders set status = 'delivered' $q$);

select 'A3 runner deliver, wrong code: ' || pg_temp.blocked(
  $q$ select public.runner_deliver((select id from public.orders_for_runner limit 1), '0000') $q$);

select 'A4 self-award a 5.0 rating   : ' || pg_temp.blocked(
  $q$ update public.profiles set rating_avg = 5.0, rating_count = 400
       where id = '11111111-1111-1111-1111-111111111111' $q$);

select 'A5 insert a free order       : ' || pg_temp.blocked(
  $q$ insert into public.orders (run_id, orderer_id, hall_id, t2g_last4, drop_spot_text,
        handoff_code, cancel_until, fee_cents)
      values ((select id from public.runs limit 1),'11111111-1111-1111-1111-111111111111',
              'pines','9999','x','0000', now() + interval '1 year', 0) $q$);

select 'A6 post a $400 run           : ' || pg_temp.blocked(
  $q$ select public.post_run('pines','geisel', now() + interval '10 min', 3, 40000) $q$);

select 'A7 read anyone''s email       : ' ||
  case when exists (select 1 from information_schema.columns
                     where table_name='public_profiles' and column_name='ucsd_email')
       then 'FAIL - email in public view' else 'ok' end;

select 'A8 read others'' profile rows : ' ||
  case when (select count(*) from public.profiles) <= 1 then 'ok'
       else 'FAIL - saw ' || (select count(*) from public.profiles)::text || ' rows' end;

-- Rate someone you never dealt with.
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
select 'A9 rate an undelivered order : ' || pg_temp.blocked(
  $q$ select public.rate_order((select id from public.orders limit 1), 5) $q$);

-- The happy path must still work: the orderer can read their own code.
select 'A10 orderer reads own code   : ' ||
  case when (select length(handoff_code) from public.orders limit 1) = 4 then 'ok' else 'FAIL' end;

-- Correct code delivers.
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
select public.runner_set_status((select id from public.orders_for_runner limit 1), 'picked_up');
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
\gset
select 'A11 right code delivers      : ' ||
  case when (select status from public.runner_deliver(
        (select id from public.orders limit 1),
        (select handoff_code from public.orders limit 1))) = 'delivered'
  then 'ok' else 'FAIL' end;
