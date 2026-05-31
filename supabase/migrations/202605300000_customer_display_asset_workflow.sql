alter table public.customer_display_assets
  alter column file_name drop not null,
  alter column content_type drop not null,
  alter column file_size drop not null,
  alter column storage_bucket drop not null,
  alter column storage_path drop not null;

alter table public.customer_display_assets
  add column if not exists asset_category text not null default 'other',
  add column if not exists description text,
  add column if not exists source text not null default 'onboarding',
  add column if not exists status text not null default 'new',
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'customer_display_assets_asset_category_check'
  ) then
    alter table public.customer_display_assets
      add constraint customer_display_assets_asset_category_check
      check (asset_category in ('logo', 'image', 'menu', 'text', 'other'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'customer_display_assets_source_check'
  ) then
    alter table public.customer_display_assets
      add constraint customer_display_assets_source_check
      check (source in ('onboarding', 'account', 'admin'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'customer_display_assets_status_check'
  ) then
    alter table public.customer_display_assets
      add constraint customer_display_assets_status_check
      check (status in ('new', 'reviewed', 'archived'));
  end if;
end $$;

create index if not exists customer_display_assets_status_created_idx
  on public.customer_display_assets(status, created_at desc);

create index if not exists customer_display_assets_category_created_idx
  on public.customer_display_assets(asset_category, created_at desc);
