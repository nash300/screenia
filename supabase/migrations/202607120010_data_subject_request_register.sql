create table if not exists public.data_subject_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  source_message_id uuid references public.customer_messages(id) on delete set null,
  request_type text not null default 'privacy_request',
  status text not null default 'received',
  description text not null,
  due_at timestamptz not null default (now() + interval '30 days'),
  completed_at timestamptz,
  admin_notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.data_subject_requests
  drop constraint if exists data_subject_requests_type_check;

alter table public.data_subject_requests
  add constraint data_subject_requests_type_check
  check (
    request_type in (
      'privacy_request',
      'access',
      'correction',
      'deletion',
      'restriction',
      'objection',
      'complaint'
    )
  );

alter table public.data_subject_requests
  drop constraint if exists data_subject_requests_status_check;

alter table public.data_subject_requests
  add constraint data_subject_requests_status_check
  check (
    status in (
      'received',
      'in_progress',
      'waiting_for_customer',
      'completed',
      'rejected'
    )
  );

create index if not exists data_subject_requests_status_due_idx
  on public.data_subject_requests(status, due_at);

create index if not exists data_subject_requests_customer_created_idx
  on public.data_subject_requests(customer_id, created_at desc);

alter table public.data_subject_requests enable row level security;

drop policy if exists "Authenticated admins can manage data subject requests"
  on public.data_subject_requests;
create policy "Authenticated admins can manage data subject requests"
  on public.data_subject_requests
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Service role can manage data subject requests"
  on public.data_subject_requests;
create policy "Service role can manage data subject requests"
  on public.data_subject_requests
  for all
  to service_role
  using (true)
  with check (true);
