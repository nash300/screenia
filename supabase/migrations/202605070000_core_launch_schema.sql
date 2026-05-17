create extension if not exists pgcrypto;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  contact_person text,
  organisation_number text,
  address text,
  city text,
  country text default 'Sweden',
  status text not null default 'draft',
  payment_status text,
  notes text,
  onboarding_token text unique,
  onboarding_token_expires_at timestamptz,
  terms_accepted_at timestamptz,
  privacy_accepted_at timestamptz,
  marketing_consent boolean not null default false,
  stripe_customer_id text,
  stripe_subscription_id text,
  activated_at timestamptz,
  inactive_reason text,
  cancellation_source text,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customers_status_idx on public.customers(status);
create index if not exists customers_email_idx on public.customers(email);
create index if not exists customers_onboarding_token_idx on public.customers(onboarding_token);
create index if not exists customers_stripe_customer_id_idx on public.customers(stripe_customer_id);

alter table public.customers add column if not exists organisation_number text;
alter table public.customers add column if not exists address text;
alter table public.customers add column if not exists city text;
alter table public.customers add column if not exists country text default 'Sweden';
alter table public.customers add column if not exists payment_status text;
alter table public.customers add column if not exists onboarding_token text;
alter table public.customers add column if not exists onboarding_token_expires_at timestamptz;
alter table public.customers add column if not exists terms_accepted_at timestamptz;
alter table public.customers add column if not exists privacy_accepted_at timestamptz;
alter table public.customers add column if not exists marketing_consent boolean not null default false;
alter table public.customers add column if not exists stripe_customer_id text;
alter table public.customers add column if not exists stripe_subscription_id text;
alter table public.customers add column if not exists activated_at timestamptz;
alter table public.customers add column if not exists inactive_reason text;
alter table public.customers add column if not exists cancellation_source text;
alter table public.customers add column if not exists cancelled_at timestamptz;
alter table public.customers add column if not exists updated_at timestamptz not null default now();

create table if not exists public.pricing_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  resolution text not null,
  setup_fee_sek integer not null,
  monthly_fee_sek integer not null,
  trial_days integer not null default 14,
  stripe_setup_price_id text,
  stripe_monthly_price_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.pricing_plans (
  code,
  name,
  resolution,
  setup_fee_sek,
  monthly_fee_sek,
  trial_days,
  is_active
)
values
  ('standard_fhd', 'Standard', 'FHD', 1998, 219, 14, true),
  ('premium_4k', 'Premium', '4K', 2398, 269, 14, true)
on conflict (code) do update set
  name = excluded.name,
  resolution = excluded.resolution,
  setup_fee_sek = excluded.setup_fee_sek,
  monthly_fee_sek = excluded.monthly_fee_sek,
  trial_days = excluded.trial_days,
  is_active = excluded.is_active,
  updated_at = now();

create table if not exists public.customer_subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  pricing_plan_id uuid references public.pricing_plans(id) on delete set null,
  status text not null default 'checkout_started',
  stripe_checkout_session_id text,
  stripe_customer_id text,
  stripe_subscription_id text,
  setup_fee_paid boolean not null default false,
  legal_acceptance_at timestamptz,
  legal_acceptance_ip text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_subscriptions_customer_id_idx
  on public.customer_subscriptions(customer_id);
create index if not exists customer_subscriptions_checkout_session_idx
  on public.customer_subscriptions(stripe_checkout_session_id);

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  device_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  name text,
  is_active boolean not null default true,
  make text,
  model text,
  serial_number text,
  purchase_cost numeric(10, 2),
  purchase_date date,
  warranty_period_months integer,
  supplier text,
  location text,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists devices_customer_id_idx on public.devices(customer_id);
create index if not exists devices_device_code_idx on public.devices(device_code);

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  file_name text,
  storage_bucket text not null default 'videos',
  storage_path text,
  src text,
  content_type text not null default 'video/mp4',
  created_at timestamptz not null default now()
);

create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  video_id uuid references public.videos(id) on delete set null,
  type text not null default 'video',
  src text not null,
  order_index integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists playlists_device_order_idx
  on public.playlists(device_id, order_index);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'videos',
  'videos',
  true,
  524288000,
  array['video/mp4']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.customers enable row level security;
alter table public.pricing_plans enable row level security;
alter table public.customer_subscriptions enable row level security;
alter table public.devices enable row level security;
alter table public.videos enable row level security;
alter table public.playlists enable row level security;

drop policy if exists "Authenticated admins can manage customers" on public.customers;
create policy "Authenticated admins can manage customers"
  on public.customers
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Setup links can read pending customer records" on public.customers;
create policy "Setup links can read pending customer records"
  on public.customers
  for select
  to anon
  using (
    onboarding_token is not null
    and (onboarding_token_expires_at is null or onboarding_token_expires_at > now())
  );

drop policy if exists "Authenticated admins can manage pricing plans" on public.pricing_plans;
create policy "Authenticated admins can manage pricing plans"
  on public.pricing_plans
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Public can read active pricing plans" on public.pricing_plans;
create policy "Public can read active pricing plans"
  on public.pricing_plans
  for select
  to anon
  using (is_active = true);

drop policy if exists "Authenticated admins can manage customer subscriptions" on public.customer_subscriptions;
create policy "Authenticated admins can manage customer subscriptions"
  on public.customer_subscriptions
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Authenticated admins can manage devices" on public.devices;
create policy "Authenticated admins can manage devices"
  on public.devices
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Displays can read active assigned devices" on public.devices;
create policy "Displays can read active assigned devices"
  on public.devices
  for select
  to anon
  using (
    is_active = true
    and exists (
      select 1
      from public.customers
      where customers.id = devices.customer_id
        and customers.status = 'active'
    )
  );

drop policy if exists "Authenticated admins can manage playlists" on public.playlists;
create policy "Authenticated admins can manage playlists"
  on public.playlists
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Displays can read playlists for active devices" on public.playlists;
create policy "Displays can read playlists for active devices"
  on public.playlists
  for select
  to anon
  using (
    exists (
      select 1
      from public.devices
      join public.customers on customers.id = devices.customer_id
      where devices.id = playlists.device_id
        and devices.is_active = true
        and customers.status = 'active'
    )
  );

drop policy if exists "Authenticated admins can manage videos" on public.videos;
create policy "Authenticated admins can manage videos"
  on public.videos
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Public can read video objects" on storage.objects;
create policy "Public can read video objects"
  on storage.objects
  for select
  to anon
  using (bucket_id = 'videos');

drop policy if exists "Authenticated admins can manage video objects" on storage.objects;
create policy "Authenticated admins can manage video objects"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'videos' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check (bucket_id = 'videos' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Authenticated admins can read customer display assets" on storage.objects;
create policy "Authenticated admins can read customer display assets"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'customer-display-assets' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
