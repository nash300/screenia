create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  actor_type text not null check (actor_type in ('system', 'admin', 'customer', 'stripe')),
  actor_id text,
  event_type text not null,
  event_description text not null,
  metadata jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_customer_created_idx
  on public.audit_events(customer_id, created_at desc);

create index if not exists audit_events_type_created_idx
  on public.audit_events(event_type, created_at desc);

create table if not exists public.consent_records (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  consent_type text not null,
  granted boolean not null,
  statement text not null,
  document_name text not null,
  document_version text not null,
  document_url text,
  collection_point text not null,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists consent_records_customer_created_idx
  on public.consent_records(customer_id, created_at desc);

create index if not exists consent_records_type_created_idx
  on public.consent_records(consent_type, created_at desc);

alter table public.audit_events enable row level security;
alter table public.consent_records enable row level security;

drop policy if exists "Authenticated admins can read audit events" on public.audit_events;
create policy "Authenticated admins can read audit events"
  on public.audit_events
  for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Service role can write audit events" on public.audit_events;
create policy "Service role can write audit events"
  on public.audit_events
  for insert
  to service_role
  with check (true);

drop policy if exists "Authenticated admins can read consent records" on public.consent_records;
create policy "Authenticated admins can read consent records"
  on public.consent_records
  for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Service role can write consent records" on public.consent_records;
create policy "Service role can write consent records"
  on public.consent_records
  for insert
  to service_role
  with check (true);
