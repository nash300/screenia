create table if not exists public.stripe_webhook_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  livemode boolean not null default false,
  processing_status text not null default 'processing',
  processing_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists stripe_webhook_events_status_idx
  on public.stripe_webhook_events(processing_status, received_at desc);

create index if not exists stripe_webhook_events_type_idx
  on public.stripe_webhook_events(event_type, received_at desc);

alter table public.stripe_webhook_events enable row level security;

drop policy if exists "Authenticated admins can read stripe webhook events"
  on public.stripe_webhook_events;
create policy "Authenticated admins can read stripe webhook events"
  on public.stripe_webhook_events
  for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
