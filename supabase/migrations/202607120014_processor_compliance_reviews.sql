create table if not exists public.processor_compliance_reviews (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  processing_purpose text not null,
  dpa_verified boolean not null default false,
  security_reviewed boolean not null default false,
  account_owner_verified boolean not null default false,
  region_or_location text,
  evidence_reference text,
  review_status text not null default 'pending',
  reviewed_at timestamptz,
  next_review_due date,
  notes text,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint processor_compliance_reviews_status_check
    check (review_status in ('pending', 'approved', 'needs_review', 'disabled'))
);

create index if not exists idx_processor_compliance_reviews_provider
  on public.processor_compliance_reviews(lower(provider));

create index if not exists idx_processor_compliance_reviews_status
  on public.processor_compliance_reviews(review_status);

create index if not exists idx_processor_compliance_reviews_next_due
  on public.processor_compliance_reviews(next_review_due);

alter table public.processor_compliance_reviews enable row level security;

drop policy if exists "Admins can manage processor compliance reviews"
  on public.processor_compliance_reviews;
create policy "Admins can manage processor compliance reviews"
  on public.processor_compliance_reviews
  for all
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Service role can manage processor compliance reviews"
  on public.processor_compliance_reviews;
create policy "Service role can manage processor compliance reviews"
  on public.processor_compliance_reviews
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
