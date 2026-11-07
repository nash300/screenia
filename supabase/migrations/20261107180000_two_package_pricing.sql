-- Current commercial pricing: two active packages, fixed shipping, and Premium video uploads.
-- Keep the historical premium_plus_4k row for old quotes/subscriptions, but stop selling it.
update public.pricing_plans
set
  monthly_fee_sek = 99,
  shipping_fee_sek = 99,
  shipping_included_devices = 50,
  additional_shipping_fee_sek = 0,
  stripe_additional_shipping_price_id = null,
  is_active = true,
  updated_at = now()
where code = 'standard_fhd';

update public.pricing_plans
set
  monthly_fee_sek = 129,
  shipping_fee_sek = 99,
  shipping_included_devices = 50,
  additional_shipping_fee_sek = 0,
  stripe_additional_shipping_price_id = null,
  is_active = true,
  updated_at = now()
where code = 'premium_4k';

update public.pricing_plans
set
  is_active = false,
  updated_at = now()
where code = 'premium_plus_4k';

comment on table public.pricing_plans is
  'Screenia pricing: Standard 99 SEK/month and Premium 129 SEK/month; both have 99 SEK fixed shipping, unlimited slides/sections, and Premium grants customer video uploads.';
