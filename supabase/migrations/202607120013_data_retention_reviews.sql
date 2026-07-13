create table if not exists public.data_retention_reviews (
  id uuid primary key default gen_random_uuid(),
  record_area text not null,
  related_customer_id uuid references public.customers(id) on delete set null,
  related_record_id text,
  legal_basis text not null,
  retention_reason text not null,
  retention_until date,
  review_status text not null default 'pending_review',
  recommended_action text not null default 'review',
  completed_at timestamptz,
  notes text,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint data_retention_reviews_status_check
    check (review_status in ('pending_review', 'retain', 'anonymize', 'delete', 'completed')),
  constraint data_retention_reviews_action_check
    check (recommended_action in ('review', 'retain', 'anonymize', 'delete'))
);

create index if not exists idx_data_retention_reviews_status
  on public.data_retention_reviews(review_status);

create index if not exists idx_data_retention_reviews_customer
  on public.data_retention_reviews(related_customer_id);

create index if not exists idx_data_retention_reviews_until
  on public.data_retention_reviews(retention_until);

alter table public.data_retention_reviews enable row level security;

drop policy if exists "Admins can manage data retention reviews"
  on public.data_retention_reviews;
create policy "Admins can manage data retention reviews"
  on public.data_retention_reviews
  for all
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Service role can manage data retention reviews"
  on public.data_retention_reviews;
create policy "Service role can manage data retention reviews"
  on public.data_retention_reviews
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
