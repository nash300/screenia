alter table public.pricing_plans
  add column if not exists shipping_included_devices integer not null default 3,
  add column if not exists additional_shipping_fee_sek integer not null default 29,
  add column if not exists stripe_additional_shipping_price_id text;

update public.pricing_plans
set
  shipping_fee_sek = 99,
  shipping_included_devices = 3,
  additional_shipping_fee_sek = 29
where is_active = true;

alter table public.pricing_plans
  drop constraint if exists pricing_plans_shipping_included_devices_check,
  add constraint pricing_plans_shipping_included_devices_check
    check (shipping_included_devices >= 1),
  drop constraint if exists pricing_plans_additional_shipping_fee_sek_check,
  add constraint pricing_plans_additional_shipping_fee_sek_check
    check (additional_shipping_fee_sek >= 0);

comment on column public.pricing_plans.shipping_fee_sek is
  'Base shipping charge in SEK including moms for the included device quantity.';
comment on column public.pricing_plans.shipping_included_devices is
  'Number of devices covered by the base shipping charge.';
comment on column public.pricing_plans.additional_shipping_fee_sek is
  'Additional shipping charge in SEK including moms per device above the included quantity.';
comment on column public.pricing_plans.stripe_additional_shipping_price_id is
  'Shared one-time Stripe Price for shipping each device above the included quantity.';

alter table public.customer_subscriptions
  add column if not exists base_shipping_fee_sek integer,
  add column if not exists shipping_included_devices integer,
  add column if not exists additional_shipping_fee_per_device_sek integer,
  add column if not exists additional_shipping_device_count integer;

alter table public.customer_subscriptions
  drop constraint if exists customer_subscriptions_base_shipping_fee_sek_check,
  add constraint customer_subscriptions_base_shipping_fee_sek_check
    check (base_shipping_fee_sek is null or base_shipping_fee_sek >= 0),
  drop constraint if exists customer_subscriptions_shipping_included_devices_check,
  add constraint customer_subscriptions_shipping_included_devices_check
    check (shipping_included_devices is null or shipping_included_devices >= 1),
  drop constraint if exists customer_subscriptions_additional_shipping_fee_check,
  add constraint customer_subscriptions_additional_shipping_fee_check
    check (additional_shipping_fee_per_device_sek is null or additional_shipping_fee_per_device_sek >= 0),
  drop constraint if exists customer_subscriptions_additional_shipping_device_count_check,
  add constraint customer_subscriptions_additional_shipping_device_count_check
    check (additional_shipping_device_count is null or additional_shipping_device_count >= 0);

comment on column public.customer_subscriptions.shipping_fee_sek is
  'Total shipping charged for this order, including moms.';
comment on column public.customer_subscriptions.base_shipping_fee_sek is
  'Base shipping charge used when the order was priced.';
comment on column public.customer_subscriptions.shipping_included_devices is
  'Device quantity covered by base shipping when the order was priced.';
comment on column public.customer_subscriptions.additional_shipping_fee_per_device_sek is
  'Additional shipping charge per device used when the order was priced.';
comment on column public.customer_subscriptions.additional_shipping_device_count is
  'Number of devices charged additional shipping for this order.';
