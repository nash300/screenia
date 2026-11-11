-- Public self-checkout state is deliberately separated from the existing
-- admin-prepared customer_subscriptions flow. Prices are recalculated by the
-- server and the immutable quote is retained for billing/audit support.
create table if not exists public.checkout_carts (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  items jsonb not null default '[]'::jsonb,
  quote_snapshot jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.checkout_orders (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid references public.checkout_carts(id) on delete set null,
  customer_id uuid not null references public.customers(id) on delete cascade,
  customer_subscription_id uuid references public.customer_subscriptions(id) on delete set null,
  status text not null default 'profile_pending',
  quote_snapshot jsonb not null default '{}'::jsonb,
  currency text not null default 'sek',
  initial_amount_sek integer not null default 0,
  monthly_amount_sek integer not null default 0,
  stripe_checkout_session_id text unique,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_payment_intent_id text,
  paid_at timestamptz,
  activation_email_sent_at timestamptz,
  account_activated_at timestamptz,
  materials_submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customers
  add column if not exists onboarding_stage text not null default 'lead';

create index if not exists checkout_carts_expires_idx
  on public.checkout_carts(expires_at);
create index if not exists checkout_orders_customer_idx
  on public.checkout_orders(customer_id, created_at desc);
create index if not exists checkout_orders_status_idx
  on public.checkout_orders(status, created_at desc);
create index if not exists checkout_orders_stripe_customer_idx
  on public.checkout_orders(stripe_customer_id);

alter table public.checkout_carts enable row level security;
alter table public.checkout_orders enable row level security;

drop policy if exists "Service role manages checkout carts" on public.checkout_carts;
create policy "Service role manages checkout carts"
  on public.checkout_carts
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Admins read checkout carts" on public.checkout_carts;
create policy "Admins read checkout carts"
  on public.checkout_carts
  for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Service role manages checkout orders" on public.checkout_orders;
create policy "Service role manages checkout orders"
  on public.checkout_orders
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Admins read checkout orders" on public.checkout_orders;
create policy "Admins read checkout orders"
  on public.checkout_orders
  for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
