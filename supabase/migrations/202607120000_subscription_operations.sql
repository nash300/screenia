alter table public.customers
  add column if not exists service_access_status text not null default 'inactive',
  add column if not exists service_access_until timestamptz;

update public.customers
set service_access_status = case
  when payment_status = 'paid' and status = 'active' then 'active'
  when payment_status = 'paid' then 'active'
  when payment_status = 'failed' then 'payment_failed'
  when payment_status = 'refunded' then 'refunded'
  when payment_status = 'cancelled' then 'cancelled'
  else service_access_status
end
where service_access_status = 'inactive';

alter table public.customers
  drop constraint if exists customers_service_access_status_check;

alter table public.customers
  add constraint customers_service_access_status_check
  check (
    service_access_status in (
      'inactive',
      'active',
      'active_until_period_end',
      'paused',
      'payment_failed',
      'cancelled',
      'refunded'
    )
  );

alter table public.customers
  drop constraint if exists customers_inactive_reason_check;

alter table public.customers
  add constraint customers_inactive_reason_check
  check (
    inactive_reason is null
    or inactive_reason in (
      'manual_suspend',
      'payment_failed',
      'subscription_cancelled',
      'customer_cancelled',
      'refunded_before_production',
      'paused'
    )
  );

create index if not exists customers_service_access_status_idx
  on public.customers(service_access_status);

create index if not exists customers_service_access_until_idx
  on public.customers(service_access_until)
  where service_access_until is not null;

alter table public.customer_subscriptions
  add column if not exists stripe_current_period_start timestamptz,
  add column if not exists stripe_current_period_end timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists cancellation_effective_at timestamptz,
  add column if not exists pause_started_at timestamptz,
  add column if not exists pause_resumes_at timestamptz,
  add column if not exists pause_reason text;

create index if not exists customer_subscriptions_period_end_idx
  on public.customer_subscriptions(stripe_current_period_end)
  where stripe_current_period_end is not null;

create table if not exists public.subscription_adjustments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  customer_subscription_id uuid references public.customer_subscriptions(id) on delete set null,
  stripe_subscription_id text not null,
  adjustment_type text not null default 'temporary_discount',
  percent_off numeric(5, 2) not null,
  duration_months integer not null,
  stripe_coupon_id text,
  reason text not null,
  status text not null default 'active',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ended_at timestamptz
);

alter table public.subscription_adjustments
  drop constraint if exists subscription_adjustments_type_check;

alter table public.subscription_adjustments
  add constraint subscription_adjustments_type_check
  check (adjustment_type in ('temporary_discount'));

alter table public.subscription_adjustments
  drop constraint if exists subscription_adjustments_percent_check;

alter table public.subscription_adjustments
  add constraint subscription_adjustments_percent_check
  check (percent_off > 0 and percent_off <= 100);

alter table public.subscription_adjustments
  drop constraint if exists subscription_adjustments_duration_check;

alter table public.subscription_adjustments
  add constraint subscription_adjustments_duration_check
  check (duration_months >= 1 and duration_months <= 36);

alter table public.subscription_adjustments enable row level security;

drop policy if exists "Authenticated admins can manage subscription adjustments"
  on public.subscription_adjustments;

create policy "Authenticated admins can manage subscription adjustments"
  on public.subscription_adjustments
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
        and customers.payment_status = 'paid'
        and customers.service_access_status in ('active', 'active_until_period_end')
        and (
          customers.service_access_until is null
          or customers.service_access_until > now()
        )
    )
  );

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
        and customers.payment_status = 'paid'
        and customers.service_access_status in ('active', 'active_until_period_end')
        and (
          customers.service_access_until is null
          or customers.service_access_until > now()
        )
    )
  );
