#!/usr/bin/env bash
# Runs the access-rule tests against a throwaway local Postgres.
#
# These are the tests that caught three real bugs in the migrations: a record
# variable in a multi-item INTO list, a CASE returning text into an enum
# column, and a profile guard that blocked the rating update its own
# rate_order function performs. Worth re-running after any change to them.
#
#   brew install postgresql@17
#   supabase/tests/run.sh
set -euo pipefail
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$HERE/.."
D=$(mktemp -d /tmp/foodrun-pg.XXXX)
trap 'pg_ctl -D "$D/data" stop -s >/dev/null 2>&1 || true; rm -rf "$D"' EXIT

initdb -D "$D/data" -U postgres --auth=trust >/dev/null
pg_ctl -D "$D/data" -o "-k $D -p 55433 -c listen_addresses=''" -l "$D/log" start >/dev/null
sleep 1
P=(psql -h "$D" -p 55433 -U postgres -q)

"${P[@]}" -c "create database foodrun;" >/dev/null
# Stand in for what Supabase provides: the auth schema, auth.uid(), the
# realtime publication, and the table grants that make 0003's REVOKEs mean
# something.
"${P[@]}" -d foodrun >/dev/null <<'SQL'
create extension if not exists pgcrypto;
do $$ begin create role anon nologin;          exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin;  exception when duplicate_object then null; end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text);
create or replace function auth.uid() returns uuid language sql stable as $f$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid; $f$;
create publication supabase_realtime;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
SQL

"${P[@]}" -d foodrun -v ON_ERROR_STOP=1 -f "$ROOT/setup.sql" >/dev/null
echo "setup.sql applied"

"${P[@]}" -d foodrun -f "$HERE/01_basics.sql" 2>&1 | grep "^T[0-9]"
"${P[@]}" -d foodrun -f "$HERE/02_attacks.sql" 2>&1 | grep "^A[0-9]"
"${P[@]}" -d foodrun -c "update public.orders set cancel_until = now() - interval '1 second';" >/dev/null
"${P[@]}" -d foodrun -f "$HERE/03_delivery_flow.sql" 2>&1 | grep "^H[0-9]"
