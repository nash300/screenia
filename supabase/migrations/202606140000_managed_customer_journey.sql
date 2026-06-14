alter table public.customers
  add column if not exists business_description text,
  add column if not exists opening_hours text,
  add column if not exists promotions text,
  add column if not exists social_media text,
  add column if not exists content_option text,
  add column if not exists content_collected_at timestamptz,
  add column if not exists preview_status text not null default 'not_started',
  add column if not exists preview_url text,
  add column if not exists preview_feedback text,
  add column if not exists tracking_number text,
  add column if not exists tracking_url text;

alter table public.customer_subscriptions
  add column if not exists tracking_number text,
  add column if not exists tracking_url text,
  add column if not exists hardware_prepared_at timestamptz,
  add column if not exists shipped_at timestamptz,
  add column if not exists content_approved_at timestamptz,
  add column if not exists activated_at timestamptz;

create index if not exists customers_content_option_idx
  on public.customers(content_option);

create index if not exists customers_preview_status_idx
  on public.customers(preview_status);

create index if not exists customer_subscriptions_tracking_idx
  on public.customer_subscriptions(tracking_number)
  where tracking_number is not null;
