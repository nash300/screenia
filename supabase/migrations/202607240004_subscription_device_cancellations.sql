create table if not exists public.subscription_device_cancellations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  customer_subscription_id uuid not null references public.customer_subscriptions(id) on delete cascade,
  device_id text not null,
  stripe_subscription_id text not null,
  stripe_subscription_item_id text not null,
  stripe_price_id text,
  pricing_plan_code text,
  monthly_fee_sek integer not null default 0,
  status text not null default 'scheduled',
  reason text,
  cancellation_requested_at timestamptz not null default now(),
  cancellation_effective_at timestamptz,
  original_subscription_item_quantity integer not null,
  adjusted_subscription_item_quantity integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_device_cancellations_status_check
    check (status in ('scheduled', 'active_until_period_end', 'cancelled', 'failed')),
  constraint subscription_device_cancellations_quantity_check
    check (
      original_subscription_item_quantity >= 1
      and adjusted_subscription_item_quantity >= 0
      and adjusted_subscription_item_quantity < original_subscription_item_quantity
    )
);

create unique index if not exists subscription_device_cancellations_one_open_device
  on public.subscription_device_cancellations(device_id)
  where status in ('scheduled', 'active_until_period_end');

create index if not exists idx_subscription_device_cancellations_customer_status
  on public.subscription_device_cancellations(customer_id, status, cancellation_requested_at desc);

drop trigger if exists set_updated_at on public.subscription_device_cancellations;
create trigger set_updated_at
  before update on public.subscription_device_cancellations
  for each row execute function public.set_updated_at();

alter table public.subscription_device_cancellations enable row level security;

drop policy if exists "Customers can read own subscription device cancellations"
  on public.subscription_device_cancellations;
create policy "Customers can read own subscription device cancellations"
  on public.subscription_device_cancellations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.customers
      where customers.id = subscription_device_cancellations.customer_id
        and customers.auth_user_id = auth.uid()
    )
  );

drop policy if exists "Admins can read subscription device cancellations"
  on public.subscription_device_cancellations;
create policy "Admins can read subscription device cancellations"
  on public.subscription_device_cancellations
  for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Service role can manage subscription device cancellations"
  on public.subscription_device_cancellations;
create policy "Service role can manage subscription device cancellations"
  on public.subscription_device_cancellations
  for all
  to service_role
  using (true)
  with check (true);
