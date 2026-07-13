create table if not exists public.privacy_incidents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  severity text not null default 'medium',
  status text not null default 'detected',
  affected_data text,
  containment_notes text,
  authority_notification_required boolean not null default false,
  authority_notified_at timestamptz,
  customer_notification_required boolean not null default false,
  customer_notified_at timestamptz,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.privacy_incidents
  drop constraint if exists privacy_incidents_severity_check;

alter table public.privacy_incidents
  add constraint privacy_incidents_severity_check
  check (severity in ('low', 'medium', 'high', 'critical'));

alter table public.privacy_incidents
  drop constraint if exists privacy_incidents_status_check;

alter table public.privacy_incidents
  add constraint privacy_incidents_status_check
  check (status in ('detected', 'investigating', 'contained', 'resolved'));

create index if not exists privacy_incidents_status_created_idx
  on public.privacy_incidents(status, created_at desc);

create index if not exists privacy_incidents_severity_created_idx
  on public.privacy_incidents(severity, created_at desc);

alter table public.privacy_incidents enable row level security;

drop policy if exists "Authenticated admins can manage privacy incidents"
  on public.privacy_incidents;
create policy "Authenticated admins can manage privacy incidents"
  on public.privacy_incidents
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Service role can manage privacy incidents"
  on public.privacy_incidents;
create policy "Service role can manage privacy incidents"
  on public.privacy_incidents
  for all
  to service_role
  using (true)
  with check (true);
