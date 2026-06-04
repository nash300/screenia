create sequence if not exists public.customer_number_seq start 10000000;
create sequence if not exists public.order_number_10_seq start 1000000000;

create or replace function public.generate_customer_number()
returns text
language plpgsql
as $$
declare
  next_number bigint;
begin
  next_number := nextval('public.customer_number_seq');
  if next_number > 99999999 then
    raise exception 'Customer number sequence exhausted';
  end if;
  return lpad(next_number::text, 8, '0');
end;
$$;

create or replace function public.generate_order_number()
returns text
language plpgsql
as $$
declare
  next_number bigint;
begin
  next_number := nextval('public.order_number_10_seq');
  if next_number > 9999999999 then
    raise exception 'Order number sequence exhausted';
  end if;
  return lpad(next_number::text, 10, '0');
end;
$$;

alter table public.customers
  add column if not exists customer_number text,
  add column if not exists requested_screen_quantity integer,
  add column if not exists requested_quote_items jsonb not null default '[]'::jsonb,
  add column if not exists billing_email text,
  add column if not exists postal_code text,
  add column if not exists business_category text,
  add column if not exists website_url text,
  add column if not exists preferred_contact_channel text,
  add column if not exists remote_support_consent boolean not null default false,
  add column if not exists analytics_consent boolean not null default true,
  add column if not exists search_keywords text;

update public.customers
set customer_number = public.generate_customer_number()
where customer_number is null;

alter table public.customers
  alter column customer_number set default public.generate_customer_number(),
  alter column customer_number set not null;

create unique index if not exists customers_customer_number_idx
  on public.customers(customer_number);

create index if not exists customers_search_keywords_idx
  on public.customers using gin (to_tsvector('simple', coalesce(search_keywords, '')));

create index if not exists customers_business_category_idx
  on public.customers(business_category);

create index if not exists customers_requested_screen_quantity_idx
  on public.customers(requested_screen_quantity);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customers_customer_number_8_digits'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_customer_number_8_digits
      check (customer_number ~ '^[0-9]{8}$');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customers_requested_screen_quantity_check'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_requested_screen_quantity_check
      check (requested_screen_quantity is null or requested_screen_quantity between 1 and 50);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customers_sweden_only_country'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_sweden_only_country
      check (
        country is null
        or lower(country) in ('sverige', 'sweden', 'se')
      );
  end if;
end $$;

create or replace function public.audit_table_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_customer_id uuid;
  changed_record_id text;
  actor_id text;
begin
  if TG_OP = 'DELETE' then
    changed_record_id := old.id::text;
    if TG_ARGV[0] = 'id' then
      changed_customer_id := old.id;
    elsif TG_ARGV[0] = 'customer_id' then
      changed_customer_id := old.customer_id;
    else
      changed_customer_id := null;
    end if;
  else
    changed_record_id := new.id::text;
    if TG_ARGV[0] = 'id' then
      changed_customer_id := new.id;
    elsif TG_ARGV[0] = 'customer_id' then
      changed_customer_id := new.customer_id;
    else
      changed_customer_id := null;
    end if;
  end if;

  actor_id := nullif(auth.uid()::text, '');

  insert into public.audit_events (
    customer_id,
    actor_type,
    actor_id,
    event_type,
    event_description,
    metadata
  )
  values (
    changed_customer_id,
    'system',
    actor_id,
    lower(TG_TABLE_NAME || '_' || TG_OP),
    TG_TABLE_NAME || ' record ' || lower(TG_OP),
    jsonb_build_object(
      'table', TG_TABLE_NAME,
      'operation', TG_OP,
      'recordId', changed_record_id,
      'old', case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
      'new', case when TG_OP in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
    )
  );

  if TG_OP = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists audit_customers_changes on public.customers;
create trigger audit_customers_changes
  after insert or update or delete on public.customers
  for each row execute function public.audit_table_change('id');

drop trigger if exists audit_customer_subscriptions_changes on public.customer_subscriptions;
create trigger audit_customer_subscriptions_changes
  after insert or update or delete on public.customer_subscriptions
  for each row execute function public.audit_table_change('customer_id');

drop trigger if exists audit_devices_changes on public.devices;
create trigger audit_devices_changes
  after insert or update or delete on public.devices
  for each row execute function public.audit_table_change('customer_id');

do $$
begin
  if to_regclass('public.customer_display_assets') is not null then
    drop trigger if exists audit_customer_display_assets_changes on public.customer_display_assets;
    create trigger audit_customer_display_assets_changes
      after insert or update or delete on public.customer_display_assets
      for each row execute function public.audit_table_change('customer_id');
  end if;

  if to_regclass('public.customer_messages') is not null then
    drop trigger if exists audit_customer_messages_changes on public.customer_messages;
    create trigger audit_customer_messages_changes
      after insert or update or delete on public.customer_messages
      for each row execute function public.audit_table_change('customer_id');
  end if;
end $$;

update public.customer_subscriptions
set order_number = public.generate_order_number()
where order_number is null
  or order_number !~ '^[0-9]{10}$';

alter table public.customer_subscriptions
  alter column order_number set default public.generate_order_number();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customer_subscriptions_order_number_10_digits'
      and conrelid = 'public.customer_subscriptions'::regclass
  ) then
    alter table public.customer_subscriptions
      add constraint customer_subscriptions_order_number_10_digits
      check (order_number ~ '^[0-9]{10}$');
  end if;
end $$;
