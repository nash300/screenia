create table if not exists public.resend_delivery_events (
  id uuid primary key default gen_random_uuid(),
  svix_id text not null unique,
  event_type text not null,
  resend_email_id text,
  recipient_email text,
  subject text,
  event_status text not null default 'received',
  raw_payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint resend_delivery_events_status_check
    check (event_status in ('received', 'action_required', 'resolved', 'ignored'))
);

create index if not exists idx_resend_delivery_events_type
  on public.resend_delivery_events(event_type, received_at desc);

create index if not exists idx_resend_delivery_events_status
  on public.resend_delivery_events(event_status, received_at desc);

create index if not exists idx_resend_delivery_events_recipient
  on public.resend_delivery_events(lower(recipient_email));

alter table public.resend_delivery_events enable row level security;

drop policy if exists "Authenticated admins can read resend delivery events"
  on public.resend_delivery_events;
create policy "Authenticated admins can read resend delivery events"
  on public.resend_delivery_events
  for select
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Service role can manage resend delivery events"
  on public.resend_delivery_events;
create policy "Service role can manage resend delivery events"
  on public.resend_delivery_events
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
