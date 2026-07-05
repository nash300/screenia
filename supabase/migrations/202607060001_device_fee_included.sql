update public.pricing_plans
set
  hardware_fee_sek = 0,
  stripe_hardware_price_id = null
where code in ('standard_fhd', 'premium_4k');
