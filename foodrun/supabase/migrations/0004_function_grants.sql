-- Take EXECUTE away from anon.
--
-- Verified against the live project: an unauthenticated caller holding only
-- the publishable key could invoke every function in the schema. They all
-- failed safe - post_run answered "Not signed in.", runner_deliver answered
-- "Not your order." - because each one checks auth.uid(). But
-- new_handoff_code() ran and returned a code, and settle_cancel_windows()
-- executed.
--
-- The cause is that 0003 wrote `revoke all on function ... from public`,
-- which does not touch a grant made directly to a role, and Supabase grants
-- EXECUTE on every new function in `public` to anon, authenticated and
-- service_role through default privileges. Revoking from PUBLIC removes a
-- privilege nobody was relying on and leaves the real one in place.
--
-- Defence in depth is why nothing was exploitable. It is not a reason to
-- leave an unauthenticated entry point open: the next function added might
-- not check.

-- Nothing in public is callable by an unauthenticated request.
revoke execute on all functions in schema public from anon;
revoke execute on all routines  in schema public from anon;
alter default privileges in schema public revoke execute on functions from anon;

-- Internals are not an API. Trigger functions are invoked by the system and
-- need no grant; new_handoff_code is a generator the server calls for you.
revoke execute on function public.new_handoff_code()        from anon, authenticated;
revoke execute on function public.touch_updated_at()        from anon, authenticated;
revoke execute on function public.log_order_event()         from anon, authenticated;
revoke execute on function public.sync_run_spots()          from anon, authenticated;
revoke execute on function public.guard_profile_update()    from anon, authenticated;
revoke execute on function public.reject_non_ucsd()         from anon, authenticated;

-- is_runner_for_order is the exception: it is referenced by the RLS policy on
-- order_events, and a policy expression is evaluated as the querying role, so
-- that role has to be able to call it.
grant execute on function public.is_runner_for_order(public.orders) to authenticated;

-- The seven calls the app actually makes, plus the window settler.
grant execute on function public.post_run(text, text, timestamptz, int, int)        to authenticated;
grant execute on function public.join_run(uuid, uuid, text, text, text, uuid)       to authenticated;
grant execute on function public.cancel_order(uuid)                                 to authenticated;
grant execute on function public.runner_set_status(uuid, public.order_status)       to authenticated;
grant execute on function public.runner_deliver(uuid, text)                         to authenticated;
grant execute on function public.rate_order(uuid, int, text)                        to authenticated;
grant execute on function public.report_order(uuid, public.report_reason, text)     to authenticated;
grant execute on function public.settle_cancel_windows()                            to authenticated;
