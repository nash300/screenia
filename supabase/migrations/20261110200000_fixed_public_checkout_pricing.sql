update public.pricing_plans
set
  setup_included_screens = 50,
  additional_setup_fee_sek = 0,
  shipping_included_devices = 50,
  additional_shipping_fee_sek = 0,
  stripe_additional_setup_price_id = null,
  stripe_additional_shipping_price_id = null
where is_active = true;
