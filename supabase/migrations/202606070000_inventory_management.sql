do $$
declare
  device_id_type text;
begin
  select format_type(attribute.atttypid, attribute.atttypmod)
    into device_id_type
  from pg_attribute attribute
  join pg_class class on class.oid = attribute.attrelid
  join pg_namespace namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'public'
    and class.relname = 'devices'
    and attribute.attname = 'id'
    and not attribute.attisdropped;

  if device_id_type is null then
    raise exception 'public.devices.id must exist before applying inventory management migration';
  end if;

  if to_regclass('public.inventory_items') is null then
    execute format($inventory_items$
      create table public.inventory_items (
        id uuid primary key default gen_random_uuid(),
        item_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
        item_type text not null default 'standard_fhd',
        status text not null default 'in_stock',
        condition text not null default 'new',
        make text,
        model text,
        serial_number text unique,
        seller text,
        invoice_number text,
        purchase_cost numeric(10, 2),
        purchase_currency text not null default 'sek',
        purchase_date date,
        warranty_period_months integer,
        warranty_until date,
        accessories jsonb not null default '{}'::jsonb,
        customer_id uuid references public.customers(id) on delete set null,
        device_id %s unique references public.devices(id) on delete set null,
        assigned_at timestamptz,
        shipped_at timestamptz,
        returned_at timestamptz,
        last_checked_at timestamptz,
        defect_description text,
        return_notes text,
        notes text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $inventory_items$, device_id_type);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'inventory_items_type_check'
      and conrelid = 'public.inventory_items'::regclass
  ) then
    alter table public.inventory_items
      add constraint inventory_items_type_check
      check (item_type in ('standard_fhd', 'premium_4k', 'spare', 'other'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'inventory_items_status_check'
      and conrelid = 'public.inventory_items'::regclass
  ) then
    alter table public.inventory_items
      add constraint inventory_items_status_check
      check (status in ('in_stock', 'reserved', 'assigned', 'shipped', 'returned', 'defective', 'in_repair', 'retired', 'lost'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'inventory_items_condition_check'
      and conrelid = 'public.inventory_items'::regclass
  ) then
    alter table public.inventory_items
      add constraint inventory_items_condition_check
      check (condition in ('new', 'tested', 'used', 'returned', 'defective', 'repaired'));
  end if;
end $$;

create index if not exists inventory_items_status_idx
  on public.inventory_items(status);

create index if not exists inventory_items_customer_id_idx
  on public.inventory_items(customer_id);

create index if not exists inventory_items_device_id_idx
  on public.inventory_items(device_id);

create index if not exists inventory_items_serial_number_idx
  on public.inventory_items(serial_number);

do $$
declare
  device_id_type text;
begin
  select format_type(attribute.atttypid, attribute.atttypmod)
    into device_id_type
  from pg_attribute attribute
  join pg_class class on class.oid = attribute.attrelid
  join pg_namespace namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'public'
    and class.relname = 'devices'
    and attribute.attname = 'id'
    and not attribute.attisdropped;

  if device_id_type is null then
    raise exception 'public.devices.id must exist before applying inventory management migration';
  end if;

  if to_regclass('public.inventory_events') is null then
    execute format($inventory_events$
      create table public.inventory_events (
        id uuid primary key default gen_random_uuid(),
        inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
        event_type text not null,
        from_status text,
        to_status text,
        customer_id uuid references public.customers(id) on delete set null,
        device_id %s references public.devices(id) on delete set null,
        notes text,
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        created_by uuid default auth.uid()
      )
    $inventory_events$, device_id_type);
  end if;
end $$;

create index if not exists inventory_events_item_created_idx
  on public.inventory_events(inventory_item_id, created_at desc);

create or replace function public.set_inventory_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_inventory_items_updated_at on public.inventory_items;
create trigger set_inventory_items_updated_at
  before update on public.inventory_items
  for each row
  execute function public.set_inventory_updated_at();

create or replace function public.log_inventory_item_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.inventory_events (
      inventory_item_id,
      event_type,
      to_status,
      customer_id,
      device_id,
      notes
    )
    values (
      new.id,
      'created',
      new.status,
      new.customer_id,
      new.device_id,
      new.notes
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.status is distinct from new.status
      or old.customer_id is distinct from new.customer_id
      or old.device_id is distinct from new.device_id
      or old.condition is distinct from new.condition
    then
      insert into public.inventory_events (
        inventory_item_id,
        event_type,
        from_status,
        to_status,
        customer_id,
        device_id,
        notes,
        metadata
      )
      values (
        new.id,
        'updated',
        old.status,
        new.status,
        new.customer_id,
        new.device_id,
        new.notes,
        jsonb_build_object(
          'from_condition', old.condition,
          'to_condition', new.condition,
          'previous_customer_id', old.customer_id,
          'previous_device_id', old.device_id
        )
      );
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists log_inventory_items_change on public.inventory_items;
create trigger log_inventory_items_change
  after insert or update on public.inventory_items
  for each row
  execute function public.log_inventory_item_change();

alter table public.inventory_items enable row level security;
alter table public.inventory_events enable row level security;

drop policy if exists "Authenticated admins can manage inventory items" on public.inventory_items;
create policy "Authenticated admins can manage inventory items"
  on public.inventory_items
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Authenticated admins can read inventory events" on public.inventory_events;
create policy "Authenticated admins can read inventory events"
  on public.inventory_events
  for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Authenticated admins can insert inventory events" on public.inventory_events;
create policy "Authenticated admins can insert inventory events"
  on public.inventory_events
  for insert
  to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
