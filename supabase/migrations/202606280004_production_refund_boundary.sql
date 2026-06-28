alter table public.customers
  add column if not exists production_status text not null default 'not_started',
  add column if not exists layout_started_at timestamptz,
  add column if not exists setup_fee_locked_at timestamptz;

create index if not exists customers_production_status_idx
  on public.customers(production_status);

create index if not exists customers_layout_started_at_idx
  on public.customers(layout_started_at)
  where layout_started_at is not null;
