update pricing_plans
set
  setup_fee_sek = 1599,
  hardware_fee_sek = 699,
  monthly_fee_sek = 249,
  trial_days = 21
where code = 'standard_fhd';

update pricing_plans
set
  setup_fee_sek = 1599,
  hardware_fee_sek = 1099,
  monthly_fee_sek = 349,
  trial_days = 21
where code = 'premium_4k';
