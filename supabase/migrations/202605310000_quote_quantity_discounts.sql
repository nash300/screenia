alter table public.customer_subscriptions
  add column if not exists screen_quantity integer not null default 1,
  add column if not exists device_discount_percent numeric(5, 2) not null default 0,
  add column if not exists device_discount_months integer not null default 0,
  add column if not exists device_discount_amount_sek integer not null default 0,
  add column if not exists monthly_discount_amount_sek integer not null default 0,
  add column if not exists stripe_discount_coupon_id text,
  add column if not exists quote_notes text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customer_subscriptions_screen_quantity_check'
      and conrelid = 'public.customer_subscriptions'::regclass
  ) then
    alter table public.customer_subscriptions
      add constraint customer_subscriptions_screen_quantity_check
        check (screen_quantity >= 1 and screen_quantity <= 50) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'customer_subscriptions_discount_percent_check'
      and conrelid = 'public.customer_subscriptions'::regclass
  ) then
    alter table public.customer_subscriptions
      add constraint customer_subscriptions_discount_percent_check
        check (device_discount_percent >= 0 and device_discount_percent <= 100) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'customer_subscriptions_discount_months_check'
      and conrelid = 'public.customer_subscriptions'::regclass
  ) then
    alter table public.customer_subscriptions
      add constraint customer_subscriptions_discount_months_check
        check (device_discount_months >= 0 and device_discount_months <= 36) not valid;
  end if;
end;
$$;
