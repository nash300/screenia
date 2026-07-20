create table if not exists public.billing_email_dispatches (
  stripe_invoice_id text primary key,
  customer_id uuid not null references public.customers(id) on delete cascade,
  recipient_email text not null,
  status text not null default 'pending',
  resend_email_id text unique,
  attempt_count integer not null default 1,
  last_error text,
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_email_dispatches_status_check
    check (status in ('pending', 'sent', 'delivered', 'failed', 'bounced')),
  constraint billing_email_dispatches_recipient_check
    check (char_length(trim(recipient_email)) between 3 and 320),
  constraint billing_email_dispatches_attempt_count_check
    check (attempt_count between 1 and 20)
);

create index if not exists idx_billing_email_dispatches_customer
  on public.billing_email_dispatches(customer_id, created_at desc);

create index if not exists idx_billing_email_dispatches_resend
  on public.billing_email_dispatches(resend_email_id)
  where resend_email_id is not null;

drop trigger if exists set_updated_at on public.billing_email_dispatches;
create trigger set_updated_at
  before update on public.billing_email_dispatches
  for each row execute function public.set_updated_at();

alter table public.billing_email_dispatches enable row level security;

drop policy if exists "Admins can read billing email dispatches"
  on public.billing_email_dispatches;
create policy "Admins can read billing email dispatches"
  on public.billing_email_dispatches
  for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Service role can manage billing email dispatches"
  on public.billing_email_dispatches;
create policy "Service role can manage billing email dispatches"
  on public.billing_email_dispatches
  for all
  to service_role
  using (true)
  with check (true);

