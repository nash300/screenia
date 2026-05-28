alter table pricing_plans
  add column if not exists hardware_fee_sek integer not null default 0,
  add column if not exists shipping_fee_sek integer not null default 99,
  add column if not exists stripe_hardware_price_id text,
  add column if not exists stripe_shipping_price_id text;

update pricing_plans
set
  setup_fee_sek = 1599,
  hardware_fee_sek = 699,
  shipping_fee_sek = 99,
  monthly_fee_sek = 219
where code = 'standard_fhd';

update pricing_plans
set
  setup_fee_sek = 1599,
  hardware_fee_sek = 1099,
  shipping_fee_sek = 99,
  monthly_fee_sek = 296
where code = 'premium_4k';

alter table customer_subscriptions
  add column if not exists hardware_fee_sek integer,
  add column if not exists shipping_fee_sek integer;
