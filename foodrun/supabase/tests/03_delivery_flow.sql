\pset tuples_only on
\pset format unaligned
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false) \g /dev/null
select public.settle_cancel_windows() \g /dev/null
select 'H1 window closes -> confirmed: ' ||
  case when (select status from public.orders_for_runner limit 1) = 'confirmed' then 'ok' else 'FAIL' end;

select count(*) from public.runner_set_status((select id from public.orders_for_runner limit 1), 'picked_up') \g /dev/null
select 'H2 runner picks up           : ' ||
  case when (select status from public.orders_for_runner limit 1) = 'picked_up' then 'ok' else 'FAIL' end;

select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false) \g /dev/null
select handoff_code as code from public.orders limit 1
\gset
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false) \g /dev/null
select 'H3 correct code delivers     : ' ||
  case when (select status from public.runner_deliver(
      (select id from public.orders_for_runner limit 1), :'code')) = 'delivered'
  then 'ok' else 'FAIL' end;

select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false) \g /dev/null
select public.rate_order((select id from public.orders limit 1), 5) \g /dev/null
select 'H4 rating recomputed by db   : ' ||
  case when (select rating_avg from public.public_profiles
              where id = '11111111-1111-1111-1111-111111111111') = 5.0
        and (select rating_count from public.public_profiles
              where id = '11111111-1111-1111-1111-111111111111') = 1
       then 'ok (5.0 from 1)' else 'FAIL' end;

select 'H5 timeline from trigger     : ' ||
  case when (select count(*) from public.order_events) >= 4
  then 'ok (' || (select count(*) from public.order_events)::text || ' events)' else 'FAIL' end;

select 'H6 spots_left derived        : ' ||
  'runs.spots_left=' || (select spots_left from public.runs limit 1)::text || ' of 3';
