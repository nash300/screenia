alter table public.customers
  alter column analytics_consent set default false,
  alter column remote_support_consent set default false,
  alter column marketing_consent set default false;

update public.customers
set
  analytics_consent = false,
  remote_support_consent = false,
  marketing_consent = false
where (
    analytics_consent = true
    or remote_support_consent = true
    or marketing_consent = true
  )
  and terms_accepted_at is null
  and privacy_accepted_at is null;

create or replace function public.screenia_consent_defaults_are_opt_in()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'customers'
        and column_name in (
          'analytics_consent',
          'remote_support_consent',
          'marketing_consent'
        )
        and coalesce(column_default, '') not in ('false', 'false::boolean')
    )
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'customers'
        and column_name = 'analytics_consent'
        and coalesce(column_default, '') in ('false', 'false::boolean')
    )
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'customers'
        and column_name = 'remote_support_consent'
        and coalesce(column_default, '') in ('false', 'false::boolean')
    )
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'customers'
        and column_name = 'marketing_consent'
        and coalesce(column_default, '') in ('false', 'false::boolean')
    )
    and not exists (
      select 1
      from public.customers
      where (
          analytics_consent = true
          or remote_support_consent = true
          or marketing_consent = true
        )
        and terms_accepted_at is null
        and privacy_accepted_at is null
    );
$$;
