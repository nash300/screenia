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
      'payment_disputed',
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
      'payment_disputed',
      'subscription_cancelled',
      'customer_cancelled',
      'refunded_before_production',
      'paused'
    )
  );
