create sequence if not exists public.order_number_seq start 1000;

create or replace function public.generate_order_number()
returns text
language sql
as $$
  select 'INF-' || to_char(now(), 'YYYYMM') || '-' || lpad(nextval('public.order_number_seq')::text, 6, '0');
$$;

alter table public.pricing_plans
  add column if not exists currency text not null default 'sek',
  add column if not exists tax_code text,
  add column if not exists tax_behavior text not null default 'exclusive';

alter table public.customer_subscriptions
  add column if not exists order_number text,
  add column if not exists currency text not null default 'sek',
  add column if not exists setup_fee_sek integer,
  add column if not exists monthly_fee_sek integer,
  add column if not exists trial_days integer,
  add column if not exists tax_status text not null default 'not_calculated',
  add column if not exists tax_amount_sek integer,
  add column if not exists total_amount_sek integer,
  add column if not exists stripe_invoice_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists stripe_payment_status text,
  add column if not exists fulfillment_status text not null default 'pending',
  add column if not exists inventory_status text not null default 'not_reserved';

update public.customer_subscriptions
set order_number = public.generate_order_number()
where order_number is null;

alter table public.customer_subscriptions
  alter column order_number set default public.generate_order_number(),
  alter column order_number set not null;

create unique index if not exists customer_subscriptions_order_number_idx
  on public.customer_subscriptions(order_number);

create index if not exists customer_subscriptions_status_fulfillment_idx
  on public.customer_subscriptions(status, fulfillment_status);

create index if not exists customer_subscriptions_stripe_subscription_idx
  on public.customer_subscriptions(stripe_subscription_id);

alter table public.devices
  add column if not exists inventory_status text not null default 'assigned',
  add column if not exists stock_location text,
  add column if not exists received_at timestamptz,
  add column if not exists assigned_at timestamptz,
  add column if not exists retired_at timestamptz,
  add column if not exists purchase_currency text not null default 'sek',
  add column if not exists inventory_notes text;

create index if not exists devices_inventory_status_idx
  on public.devices(inventory_status);

create table if not exists public.tax_payments (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  currency text not null default 'sek',
  taxable_amount_sek integer not null default 0,
  tax_amount_sek integer not null default 0,
  status text not null default 'draft',
  paid_at timestamptz,
  reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tax_payments_period_idx
  on public.tax_payments(period_start, period_end);

alter table public.tax_payments enable row level security;

drop policy if exists "Authenticated admins can manage tax payments" on public.tax_payments;
create policy "Authenticated admins can manage tax payments"
  on public.tax_payments
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
