\set ON_ERROR_STOP 0
\pset tuples_only on
\pset format unaligned

-- Two students.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111','runner@ucsd.edu'),
  ('22222222-2222-2222-2222-222222222222','orderer@ucsd.edu')
on conflict do nothing;
insert into public.profiles (id, name, ucsd_email) values
  ('11111111-1111-1111-1111-111111111111','Marcus J','runner@ucsd.edu'),
  ('22222222-2222-2222-2222-222222222222','Priya K','orderer@ucsd.edu')
on conflict do nothing;

create or replace function pg_temp.as_runner() returns void language sql as $$
  select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
$$;
create or replace function pg_temp.as_orderer() returns void language sql as $$
  select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
$$;

set role authenticated;

-- Runner posts a run.
select pg_temp.as_runner();
select 'T1 post_run                 : ' ||
  case when (select count(*) from public.post_run('pines','geisel', now() + interval '20 min', 3, 200)) = 1
       then 'ok' else 'FAIL' end;

-- Orderer joins it.
select pg_temp.as_orderer();
select 'T2 join_run                 : ' ||
  case when (select count(*) from public.join_run(
      (select id from public.runs limit 1), null, '4821', 'Priya', 'Geisel 2F, Table 14')) = 1
    then 'ok' else 'FAIL' end;

-- T3: the fee comes from the run, not from anything a client sent.
select 'T3 fee from run not client  : ' ||
  case when (select fee_cents from public.orders limit 1) = 200 then 'ok' else 'FAIL' end;

-- T4: a runner must not be able to read the handoff code.
select pg_temp.as_runner();
select 'T4 runner cannot read code  : ' ||
  case when (select count(*) from public.orders) = 0 then 'ok'
       else 'FAIL - runner read ' || (select count(*) from public.orders)::text || ' order rows' end;

-- T5: the runner's view works, and has no handoff_code column at all.
select 'T5 runner view, no code col : ' ||
  case when (select count(*) from public.orders_for_runner) = 1
        and not exists (select 1 from information_schema.columns
                         where table_name = 'orders_for_runner' and column_name = 'handoff_code')
       then 'ok' else 'FAIL' end;
