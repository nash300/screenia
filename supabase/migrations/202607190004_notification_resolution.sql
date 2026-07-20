alter table public.admin_notifications
  add column if not exists resolved_at timestamptz,
  add column if not exists resolution_event_type text;

create index if not exists idx_admin_notifications_unresolved_created
  on public.admin_notifications(resolved_at, created_at desc);

