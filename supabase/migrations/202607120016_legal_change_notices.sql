create table if not exists public.legal_change_notices (
  id uuid primary key default gen_random_uuid(),
  document_type text not null,
  document_version text not null,
  change_summary text not null,
  effective_at timestamptz,
  notice_required boolean not null default true,
  reacceptance_required boolean not null default false,
  notice_status text not null default 'draft',
  notice_sent_at timestamptz,
  evidence_reference text,
  notes text,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legal_change_notices_document_type_check
    check (document_type in ('terms', 'privacy', 'cookie', 'subscription_billing', 'support_service')),
  constraint legal_change_notices_status_check
    check (notice_status in ('draft', 'approved', 'sent', 'not_required', 'needs_review'))
);

create index if not exists idx_legal_change_notices_document
  on public.legal_change_notices(document_type, document_version);

create index if not exists idx_legal_change_notices_status
  on public.legal_change_notices(notice_status);

alter table public.legal_change_notices enable row level security;

drop policy if exists "Admins can manage legal change notices"
  on public.legal_change_notices;
create policy "Admins can manage legal change notices"
  on public.legal_change_notices
  for all
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Service role can manage legal change notices"
  on public.legal_change_notices;
create policy "Service role can manage legal change notices"
  on public.legal_change_notices
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
