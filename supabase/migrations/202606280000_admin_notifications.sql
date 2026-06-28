create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  event_type text not null,
  title text not null,
  message text not null,
  priority text not null default 'normal',
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.admin_notifications
  add column if not exists customer_id uuid references public.customers(id) on delete set null,
  add column if not exists event_type text,
  add column if not exists title text,
  add column if not exists message text,
  add column if not exists priority text not null default 'normal',
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists read_at timestamptz,
  add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'admin_notifications_priority_check'
      and conrelid = 'public.admin_notifications'::regclass
  ) then
    alter table public.admin_notifications
      add constraint admin_notifications_priority_check
      check (priority in ('low', 'normal', 'high', 'urgent'));
  end if;
end $$;

create index if not exists admin_notifications_created_idx
  on public.admin_notifications(created_at desc);
create index if not exists admin_notifications_unread_created_idx
  on public.admin_notifications(read_at, created_at desc);
create index if not exists admin_notifications_customer_created_idx
  on public.admin_notifications(customer_id, created_at desc);

alter table public.admin_notifications enable row level security;

drop policy if exists "Authenticated admins can read admin notifications" on public.admin_notifications;
create policy "Authenticated admins can read admin notifications"
  on public.admin_notifications
  for select
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Authenticated admins can update admin notifications" on public.admin_notifications;
create policy "Authenticated admins can update admin notifications"
  on public.admin_notifications
  for update
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Service role can manage admin notifications" on public.admin_notifications;
create policy "Service role can manage admin notifications"
  on public.admin_notifications
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
