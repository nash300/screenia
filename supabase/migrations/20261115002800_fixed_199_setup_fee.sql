-- Replace the retired 499 SEK / per-extra-screen setup rule with the current
-- fixed 199 SEK order setup fee. Existing orders keep their immutable snapshots.
update public.pricing_plans
set
  setup_fee_sek = 199,
  setup_included_screens = 50,
  additional_setup_fee_sek = 0,
  stripe_setup_price_id = null,
  stripe_additional_setup_price_id = null,
  updated_at = now()
where code in ('standard_fhd', 'premium_4k')
  and is_active = true;

comment on column public.pricing_plans.setup_fee_sek is
  'Fixed one-time administrative setup fee in SEK, currently 199, including VAT.';
comment on column public.pricing_plans.setup_included_screens is
  'Maximum screens covered by the fixed setup fee, currently 50.';
comment on column public.pricing_plans.additional_setup_fee_sek is
  'Retained for historical quote snapshots; current active plans use 0.';
