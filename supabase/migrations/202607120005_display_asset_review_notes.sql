alter table public.customer_display_assets
  add column if not exists admin_note text,
  add column if not exists admin_note_updated_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid;

update public.customer_display_assets
set status = 'new'
where status is null or status not in ('new', 'reviewed', 'archived');

alter table public.customer_display_assets
  alter column status set default 'new';

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'customer_display_assets_status_check'
  ) then
    alter table public.customer_display_assets
      drop constraint customer_display_assets_status_check;
  end if;

  alter table public.customer_display_assets
    add constraint customer_display_assets_status_check
    check (status in ('new', 'reviewed', 'archived'));
end $$;

create or replace function public.screenia_display_asset_review_workflow_ready()
returns boolean
language sql
stable
as $$
  select
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'customer_display_assets'
        and column_name = 'admin_note'
    )
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'customer_display_assets'
        and column_name = 'admin_note_updated_at'
    )
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'customer_display_assets'
        and column_name = 'reviewed_at'
    )
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'customer_display_assets'
        and column_name = 'reviewed_by'
    )
    and exists (
      select 1
      from pg_constraint
      where conname = 'customer_display_assets_status_check'
        and conrelid = 'public.customer_display_assets'::regclass
    )
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'customer_display_assets'
        and column_name = 'status'
        and column_default = '''new''::text'
    )
    and not exists (
      select 1
      from public.customer_display_assets
      where status is null or status not in ('new', 'reviewed', 'archived')
    );
$$;
