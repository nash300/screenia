alter table public.pricing_plans
  add column if not exists setup_included_screens integer not null default 3,
  add column if not exists additional_setup_fee_sek integer not null default 249,
  add column if not exists stripe_additional_setup_price_id text;

update public.pricing_plans
set
  setup_included_screens = 3,
  additional_setup_fee_sek = 249
where code in ('standard_fhd', 'premium_4k');

alter table public.customer_subscriptions
  add column if not exists base_setup_fee_sek integer,
  add column if not exists setup_included_screens integer not null default 3,
  add column if not exists additional_setup_fee_per_screen_sek integer not null default 249,
  add column if not exists additional_setup_screen_count integer not null default 0;

alter table public.pricing_plans
  drop constraint if exists pricing_plans_setup_included_screens_check,
  add constraint pricing_plans_setup_included_screens_check
    check (setup_included_screens > 0),
  drop constraint if exists pricing_plans_additional_setup_fee_sek_check,
  add constraint pricing_plans_additional_setup_fee_sek_check
    check (additional_setup_fee_sek >= 0);

alter table public.customer_subscriptions
  drop constraint if exists customer_subscriptions_setup_included_screens_check,
  add constraint customer_subscriptions_setup_included_screens_check
    check (setup_included_screens > 0),
  drop constraint if exists customer_subscriptions_additional_setup_fee_check,
  add constraint customer_subscriptions_additional_setup_fee_check
    check (additional_setup_fee_per_screen_sek >= 0),
  drop constraint if exists customer_subscriptions_additional_setup_count_check,
  add constraint customer_subscriptions_additional_setup_count_check
    check (additional_setup_screen_count >= 0);

comment on column public.pricing_plans.setup_fee_sek is
  'Base setup fee including setup_included_screens screens.';
comment on column public.pricing_plans.additional_setup_fee_sek is
  'Setup fee charged for each screen above setup_included_screens.';
comment on column public.customer_subscriptions.setup_fee_sek is
  'Total setup fee for this order, including additional screens.';
