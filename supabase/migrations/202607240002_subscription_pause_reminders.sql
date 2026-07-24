create table if not exists public.subscription_pause_reminder_dispatches (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  stripe_subscription_id text not null,
  reminder_kind text not null default 'pause_resumes_14_days',
  pause_resumes_at timestamptz not null,
  recipient_email text not null,
  status text not null default 'pending',
  resend_email_id text unique,
  attempt_count integer not null default 1,
  last_error text,
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_pause_reminder_status_check
    check (status in ('pending', 'sent', 'delivered', 'failed', 'bounced')),
  constraint subscription_pause_reminder_recipient_check
    check (char_length(trim(recipient_email)) between 3 and 320),
  constraint subscription_pause_reminder_attempt_count_check
    check (attempt_count between 1 and 20),
  constraint subscription_pause_reminder_unique
    unique (stripe_subscription_id, reminder_kind, pause_resumes_at)
);

create index if not exists idx_subscription_pause_reminders_customer
  on public.subscription_pause_reminder_dispatches(customer_id, created_at desc);

create index if not exists idx_subscription_pause_reminders_resend
  on public.subscription_pause_reminder_dispatches(resend_email_id)
  where resend_email_id is not null;

drop trigger if exists set_updated_at on public.subscription_pause_reminder_dispatches;
create trigger set_updated_at
  before update on public.subscription_pause_reminder_dispatches
  for each row execute function public.set_updated_at();

alter table public.subscription_pause_reminder_dispatches enable row level security;

drop policy if exists "Admins can read subscription pause reminder dispatches"
  on public.subscription_pause_reminder_dispatches;
create policy "Admins can read subscription pause reminder dispatches"
  on public.subscription_pause_reminder_dispatches
  for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Service role can manage subscription pause reminder dispatches"
  on public.subscription_pause_reminder_dispatches;
create policy "Service role can manage subscription pause reminder dispatches"
  on public.subscription_pause_reminder_dispatches
  for all
  to service_role
  using (true)
  with check (true);
