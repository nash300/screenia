create table if not exists public.subscription_device_pauses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  customer_subscription_id uuid not null references public.customer_subscriptions(id) on delete cascade,
  device_id uuid not null references public.devices(id) on delete cascade,
  stripe_subscription_id text not null,
  stripe_subscription_item_id text not null,
  stripe_price_id text,
  pricing_plan_code text,
  monthly_fee_sek integer not null default 0,
  status text not null default 'active',
  reason text,
  pause_started_at timestamptz not null default now(),
  pause_resumes_at timestamptz not null,
  original_subscription_item_quantity integer not null,
  adjusted_subscription_item_quantity integer not null,
  resumed_at timestamptz,
  resume_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_device_pauses_status_check
    check (status in ('active', 'resumed', 'failed')),
  constraint subscription_device_pauses_quantity_check
    check (
      original_subscription_item_quantity >= 1
      and adjusted_subscription_item_quantity >= 0
      and adjusted_subscription_item_quantity < original_subscription_item_quantity
    ),
  constraint subscription_device_pauses_pause_window_check
    check (pause_resumes_at > pause_started_at)
);

create unique index if not exists subscription_device_pauses_one_active_device
  on public.subscription_device_pauses(device_id)
  where status = 'active';

create index if not exists idx_subscription_device_pauses_customer_status
  on public.subscription_device_pauses(customer_id, status, pause_resumes_at);

create index if not exists idx_subscription_device_pauses_due
  on public.subscription_device_pauses(status, pause_resumes_at);

drop trigger if exists set_updated_at on public.subscription_device_pauses;
create trigger set_updated_at
  before update on public.subscription_device_pauses
  for each row execute function public.set_updated_at();

alter table public.subscription_device_pauses enable row level security;

drop policy if exists "Customers can read own subscription device pauses"
  on public.subscription_device_pauses;
create policy "Customers can read own subscription device pauses"
  on public.subscription_device_pauses
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.customers
      where customers.id = subscription_device_pauses.customer_id
        and customers.auth_user_id = auth.uid()
    )
  );

drop policy if exists "Admins can read subscription device pauses"
  on public.subscription_device_pauses;
create policy "Admins can read subscription device pauses"
  on public.subscription_device_pauses
  for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Service role can manage subscription device pauses"
  on public.subscription_device_pauses;
create policy "Service role can manage subscription device pauses"
  on public.subscription_device_pauses
  for all
  to service_role
  using (true)
  with check (true);
