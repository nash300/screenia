update public.pricing_plans
set hardware_fee_sek = 699
where code = 'standard_fhd';

update public.pricing_plans
set hardware_fee_sek = 1099
where code = 'premium_4k';
