-- Remove legacy broad policies left behind by the original schema bootstrap.
-- The current server API and admin policies are the intended access boundary.
drop policy if exists "Allow authenticated manage customers"
  on public.customers;
drop policy if exists "Allow authenticated manage devices"
  on public.devices;
drop policy if exists "Allow public read devices"
  on public.devices;
drop policy if exists "Allow authenticated manage playlists"
  on public.playlists;
drop policy if exists "Allow public read playlists"
  on public.playlists;
drop policy if exists "Allow public read pricing plans"
  on public.pricing_plans;

-- Make policy roles explicit. This removes service-role policies from the
-- anonymous/authenticated policy evaluation path and avoids accidental policy
-- broadening when a role predicate is changed later.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
  loop
    if policy_record.policyname like 'Service role %' then
      execute format(
        'alter policy %I on %I.%I to service_role',
        policy_record.policyname,
        policy_record.schemaname,
        policy_record.tablename
      );
    elsif policy_record.policyname like 'Authenticated admins %'
      or policy_record.policyname like 'Admins %'
      or policy_record.policyname like 'Customers %'
    then
      execute format(
        'alter policy %I on %I.%I to authenticated',
        policy_record.policyname,
        policy_record.schemaname,
        policy_record.tablename
      );
    elsif policy_record.policyname like 'Public can read %' then
      execute format(
        'alter policy %I on %I.%I to anon, authenticated',
        policy_record.policyname,
        policy_record.schemaname,
        policy_record.tablename
      );
    end if;
  end loop;
end;
$$;
