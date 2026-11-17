-- Current active packages use one fixed 199 SEK setup fee for the supported order size.
-- Existing customer orders and issued quotes retain their recorded snapshots.
update public.pricing_plans
set
  setup_fee_sek = 199,
  setup_included_screens = 50,
  additional_setup_fee_sek = 0,
  updated_at = now()
where is_active = true
  and code in ('standard_fhd', 'premium_4k');

comment on table public.pricing_plans is
  'Screenia pricing: Standard 99 SEK/month and Premium 129 SEK/month; both use a fixed 199 SEK setup fee, 99 SEK fixed shipping, and Premium grants customer video uploads.';
