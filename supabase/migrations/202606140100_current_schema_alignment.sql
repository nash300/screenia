create extension if not exists pgcrypto;

create sequence if not exists public.customer_number_seq start 10000000;
create sequence if not exists public.order_number_10_seq start 1000000000;

create or replace function public.generate_customer_number()
returns text
language plpgsql
as $$
declare
  next_number bigint;
begin
  next_number := nextval('public.customer_number_seq');
  if next_number > 99999999 then
    raise exception 'Customer number sequence exhausted';
  end if;
  return lpad(next_number::text, 8, '0');
end;
$$;

create or replace function public.generate_order_number()
returns text
language plpgsql
as $$
declare
  next_number bigint;
begin
  next_number := nextval('public.order_number_10_seq');
  if next_number > 9999999999 then
    raise exception 'Order number sequence exhausted';
  end if;
  return lpad(next_number::text, 10, '0');
end;
$$;

alter table public.customers
  add column if not exists auth_user_id uuid unique,
  add column if not exists customer_number text,
  add column if not exists requested_screen_quantity integer,
  add column if not exists requested_quote_items jsonb not null default '[]'::jsonb,
  add column if not exists billing_email text,
  add column if not exists postal_code text,
  add column if not exists business_category text,
  add column if not exists website_url text,
  add column if not exists preferred_contact_channel text,
  add column if not exists remote_support_consent boolean not null default false,
  add column if not exists analytics_consent boolean not null default true,
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
  add column if not exists tracking_url text,
  add column if not exists cancellation_reason text,
  add column if not exists cancellation_details text;

update public.customers
set customer_number = public.generate_customer_number()
where customer_number is null;

alter table public.customers
  alter column customer_number set default public.generate_customer_number(),
  alter column customer_number set not null;

create unique index if not exists customers_customer_number_idx
  on public.customers(customer_number);
create index if not exists customers_auth_user_id_idx
  on public.customers(auth_user_id);
create index if not exists customers_content_option_idx
  on public.customers(content_option);
create index if not exists customers_preview_status_idx
  on public.customers(preview_status);
create index if not exists customers_business_category_idx
  on public.customers(business_category);
create index if not exists customers_requested_screen_quantity_idx
  on public.customers(requested_screen_quantity);

alter table public.pricing_plans
  add column if not exists hardware_fee_sek integer not null default 0,
  add column if not exists shipping_fee_sek integer not null default 99,
  add column if not exists currency text not null default 'sek',
  add column if not exists stripe_hardware_price_id text,
  add column if not exists stripe_shipping_price_id text;

alter table public.customer_subscriptions
  add column if not exists order_number text,
  add column if not exists screen_quantity integer not null default 1,
  add column if not exists hardware_fee_sek integer,
  add column if not exists shipping_fee_sek integer,
  add column if not exists monthly_fee_sek integer,
  add column if not exists tax_amount_sek integer,
  add column if not exists total_amount_sek integer,
  add column if not exists tax_status text not null default 'not_calculated',
  add column if not exists stripe_payment_status text,
  add column if not exists fulfillment_status text not null default 'pending',
  add column if not exists inventory_status text not null default 'not_reserved',
  add column if not exists device_discount_percent integer not null default 0,
  add column if not exists device_discount_months integer not null default 0,
  add column if not exists device_discount_amount_sek integer not null default 0,
  add column if not exists monthly_discount_amount_sek integer not null default 0,
  add column if not exists quote_notes text,
  add column if not exists quote_items jsonb not null default '[]'::jsonb,
  add column if not exists tracking_number text,
  add column if not exists tracking_url text,
  add column if not exists shipped_at timestamptz,
  add column if not exists delivered_at timestamptz;

update public.customer_subscriptions
set order_number = public.generate_order_number()
where order_number is null
  or order_number !~ '^[0-9]{10}$';

alter table public.customer_subscriptions
  alter column order_number set default public.generate_order_number(),
  alter column order_number set not null;

create unique index if not exists customer_subscriptions_order_number_idx
  on public.customer_subscriptions(order_number);
create index if not exists customer_subscriptions_status_fulfillment_idx
  on public.customer_subscriptions(status, fulfillment_status);
create index if not exists customer_subscriptions_stripe_subscription_idx
  on public.customer_subscriptions(stripe_subscription_id);
create index if not exists customer_subscriptions_tracking_idx
  on public.customer_subscriptions(tracking_number)
  where tracking_number is not null;

alter table public.devices
  add column if not exists inventory_status text not null default 'assigned',
  add column if not exists inventory_notes text,
  add column if not exists last_seen_at timestamptz;

create index if not exists devices_inventory_status_idx
  on public.devices(inventory_status);

create table if not exists public.customer_messages (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  subject text,
  message text not null,
  status text not null default 'new',
  ticket_number text,
  request_type text not null default 'general',
  priority text not null default 'normal',
  related_ticket_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customer_messages
  add column if not exists ticket_number text,
  add column if not exists request_type text not null default 'general',
  add column if not exists priority text not null default 'normal',
  add column if not exists related_ticket_number text;

create index if not exists customer_messages_customer_id_idx
  on public.customer_messages(customer_id, created_at desc);
create index if not exists customer_messages_ticket_number_idx
  on public.customer_messages(ticket_number, created_at desc)
  where ticket_number is not null;
create index if not exists customer_messages_request_type_idx
  on public.customer_messages(request_type, created_at desc);
create index if not exists customer_messages_related_ticket_idx
  on public.customer_messages(related_ticket_number, created_at desc)
  where related_ticket_number is not null;

create table if not exists public.customer_message_files (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.customer_messages(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  file_name text not null,
  content_type text not null,
  file_size integer not null,
  storage_bucket text not null default 'customer-message-files',
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists customer_message_files_customer_id_idx
  on public.customer_message_files(customer_id, created_at desc);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  item_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  item_type text not null default 'standard_fhd',
  status text not null default 'in_stock',
  condition text not null default 'new',
  make text,
  model text,
  serial_number text unique,
  seller text,
  invoice_number text,
  purchase_cost numeric(10, 2),
  purchase_currency text not null default 'sek',
  purchase_date date,
  warranty_period_months integer,
  warranty_until date,
  accessories jsonb not null default '{}'::jsonb,
  customer_id uuid references public.customers(id) on delete set null,
  device_id uuid unique references public.devices(id) on delete set null,
  assigned_at timestamptz,
  shipped_at timestamptz,
  returned_at timestamptz,
  last_checked_at timestamptz,
  defect_description text,
  return_notes text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inventory_items_status_idx
  on public.inventory_items(status);
create index if not exists inventory_items_customer_id_idx
  on public.inventory_items(customer_id);
create index if not exists inventory_items_device_id_idx
  on public.inventory_items(device_id);
create index if not exists inventory_items_serial_number_idx
  on public.inventory_items(serial_number);

create table if not exists public.inventory_events (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  customer_id uuid references public.customers(id) on delete set null,
  device_id uuid references public.devices(id) on delete set null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create index if not exists inventory_events_item_created_idx
  on public.inventory_events(inventory_item_id, created_at desc);

create table if not exists public.customer_display_assets (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  file_name text,
  content_type text,
  file_size integer,
  storage_bucket text,
  storage_path text,
  asset_category text not null default 'other',
  description text,
  source text not null default 'admin',
  status text not null default 'uploaded',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customer_display_assets
  add column if not exists file_size integer,
  add column if not exists asset_category text not null default 'other',
  add column if not exists description text,
  add column if not exists source text not null default 'admin',
  add column if not exists status text not null default 'uploaded',
  add column if not exists updated_at timestamptz not null default now();

alter table public.customer_display_assets
  alter column storage_bucket drop not null,
  alter column storage_path drop not null;

create index if not exists customer_display_assets_customer_id_idx
  on public.customer_display_assets(customer_id);
create index if not exists customer_display_assets_status_created_idx
  on public.customer_display_assets(status, created_at desc);
create index if not exists customer_display_assets_category_created_idx
  on public.customer_display_assets(asset_category, created_at desc);

create table if not exists public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  document_type text not null,
  title text not null,
  version text not null,
  effective_at timestamptz not null default now(),
  published_at timestamptz,
  status text not null default 'active',
  summary text,
  content text,
  pdf_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.legal_documents
  add column if not exists published_at timestamptz,
  add column if not exists summary text,
  add column if not exists content text,
  add column if not exists pdf_url text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists legal_documents_type_status_idx
  on public.legal_documents(document_type, status, effective_at desc);

create table if not exists public.customer_legal_agreements (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  legal_document_id uuid references public.legal_documents(id) on delete set null,
  document_type text not null,
  document_title text not null,
  document_version text not null,
  document_effective_at timestamptz,
  document_url text,
  pdf_url text,
  content_snapshot text,
  accepted_at timestamptz not null default now(),
  collection_point text not null default 'onboarding',
  accepted_ip text,
  accepted_user_agent text,
  created_at timestamptz not null default now()
);

alter table public.customer_legal_agreements
  add column if not exists document_url text,
  add column if not exists pdf_url text,
  add column if not exists content_snapshot text,
  add column if not exists accepted_ip text,
  add column if not exists accepted_user_agent text,
  add column if not exists collection_point text not null default 'onboarding',
  add column if not exists created_at timestamptz not null default now();

create index if not exists customer_legal_agreements_customer_idx
  on public.customer_legal_agreements(customer_id, document_type, accepted_at desc);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  actor_type text not null,
  actor_id text,
  event_type text not null,
  event_description text not null,
  metadata jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_customer_created_idx
  on public.audit_events(customer_id, created_at desc);
create index if not exists audit_events_type_created_idx
  on public.audit_events(event_type, created_at desc);

create table if not exists public.consent_records (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  consent_type text not null,
  granted boolean not null,
  statement text not null,
  document_name text not null,
  document_version text not null,
  document_url text,
  collection_point text,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.consent_records
  add column if not exists granted boolean,
  add column if not exists statement text,
  add column if not exists document_name text,
  add column if not exists document_version text,
  add column if not exists document_url text,
  add column if not exists collection_point text,
  add column if not exists ip_address text,
  add column if not exists user_agent text;

create index if not exists consent_records_customer_created_idx
  on public.consent_records(customer_id, created_at desc);
create index if not exists consent_records_type_created_idx
  on public.consent_records(consent_type, created_at desc);

alter table public.customer_messages enable row level security;
alter table public.customer_message_files enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_events enable row level security;
alter table public.customer_display_assets enable row level security;
alter table public.legal_documents enable row level security;
alter table public.customer_legal_agreements enable row level security;
alter table public.audit_events enable row level security;
alter table public.consent_records enable row level security;
