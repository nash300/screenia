create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  target_name text;
  target_table regclass;
begin
  foreach target_name in array array[
    'public.customers',
    'public.pricing_plans',
    'public.customer_subscriptions',
    'public.devices',
    'public.videos',
    'public.playlists',
    'public.customer_messages',
    'public.customer_display_assets',
    'public.legal_documents',
    'public.inventory_items'
  ]
  loop
    target_table := to_regclass(target_name);

    if target_table is not null and exists (
      select 1
      from pg_attribute
      where attrelid = target_table
        and attname = 'updated_at'
        and not attisdropped
    ) then
      execute format('drop trigger if exists set_updated_at on %s', target_table);
      execute format(
        'create trigger set_updated_at before update on %s for each row execute function public.set_updated_at()',
        target_table
      );
    end if;
  end loop;
end;
$$;
