update public.pricing_plans
set setup_fee_sek = 1999
where code in ('standard_fhd', 'premium_4k');
