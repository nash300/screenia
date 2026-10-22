-- Security follow-up for the live Screenia project.
-- Keep this migration idempotent because the live schema and migration ledger
-- currently require a controlled reconciliation rather than a blind db push.

-- subscription_device_pauses is customer-owned operational data. Customers may
-- read their own rows, admins may read all rows, and only the server role may
-- manage them.
alter table public.subscription_device_pauses enable row level security;

drop policy if exists "Customers can read own subscription device pauses"
  on public.subscription_device_pauses;
create policy "Customers can read own subscription device pauses"
  on public.subscription_device_pauses
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.customers
      where customers.id = subscription_device_pauses.customer_id
        and customers.auth_user_id = auth.uid()
    )
  );

drop policy if exists "Admins can read subscription device pauses"
  on public.subscription_device_pauses;
create policy "Admins can read subscription device pauses"
  on public.subscription_device_pauses
  for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Service role can manage subscription device pauses"
  on public.subscription_device_pauses;
create policy "Service role can manage subscription device pauses"
  on public.subscription_device_pauses
  for all
  to service_role
  using (true)
  with check (true);

-- Explicit table grants keep the Data API boundary deliberate and preserve the
-- server-side admin client after default public grants are tightened.
grant select on table public.subscription_device_pauses to authenticated;
grant select, insert, update, delete on table public.subscription_device_pauses
  to service_role;

-- Future public tables must opt in to anon/authenticated Data API access. The
-- server role remains available for server-side Supabase clients.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to service_role;

-- SECURITY DEFINER functions in the exposed public schema are internal
-- readiness/trigger helpers. They must not be callable through public RPC.
revoke all on function public.audit_table_change()
  from public, anon, authenticated;
revoke all on function public.screenia_consent_defaults_are_opt_in()
  from public, anon, authenticated;
revoke all on function public.screenia_request_privacy_consent_ready(text)
  from public, anon, authenticated;
grant execute on function public.screenia_consent_defaults_are_opt_in()
  to service_role;
grant execute on function public.screenia_request_privacy_consent_ready(text)
  to service_role;

-- Pin search_path on public helper functions to avoid mutable-search-path
-- resolution when they are called by triggers or privileged server code.
alter function public.generate_customer_number()
  set search_path = public, pg_temp;
alter function public.generate_device_code()
  set search_path = public, pg_temp;
alter function public.generate_order_number()
  set search_path = public, pg_temp;
alter function public.log_inventory_item_change()
  set search_path = public, pg_temp;
alter function public.screenia_display_asset_review_workflow_ready()
  set search_path = public, pg_temp;
alter function public.set_device_code()
  set search_path = public, pg_temp;
alter function public.set_inventory_updated_at()
  set search_path = public, pg_temp;
alter function public.set_updated_at()
  set search_path = public, pg_temp;
