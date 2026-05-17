create table if not exists public.customer_display_assets (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  file_name text not null,
  content_type text not null,
  file_size integer not null,
  storage_bucket text not null default 'customer-display-assets',
  storage_path text not null,
  uploaded_by text not null default 'customer',
  created_at timestamptz not null default now()
);

create index if not exists customer_display_assets_customer_id_idx
  on public.customer_display_assets(customer_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'customer-display-assets',
  'customer-display-assets',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'application/pdf'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.customer_display_assets enable row level security;

drop policy if exists "Authenticated admins can read customer display asset metadata" on public.customer_display_assets;
create policy "Authenticated admins can read customer display asset metadata"
  on public.customer_display_assets
  for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Service role can manage customer display asset metadata" on public.customer_display_assets;
create policy "Service role can manage customer display asset metadata"
  on public.customer_display_assets
  for all
  to service_role
  using (true)
  with check (true);
