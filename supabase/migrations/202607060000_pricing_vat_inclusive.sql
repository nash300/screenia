alter table public.pricing_plans
  alter column tax_behavior set default 'inclusive';

update public.pricing_plans
set tax_behavior = 'inclusive'
where tax_behavior is null
   or tax_behavior in ('exclusive', 'unspecified');
