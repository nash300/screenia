create table if not exists public.admin_access_reviews (
  id uuid primary key default gen_random_uuid(),
  admin_email text not null,
  auth_user_id text,
  review_status text not null default 'pending',
  mfa_verified boolean not null default false,
  access_confirmed boolean not null default false,
  reviewed_at timestamptz,
  reviewed_by text,
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_access_reviews_status_check
    check (review_status in ('pending', 'approved', 'needs_review', 'removed'))
);

create index if not exists idx_admin_access_reviews_status
  on public.admin_access_reviews(review_status);

create index if not exists idx_admin_access_reviews_email
  on public.admin_access_reviews(lower(admin_email));

alter table public.admin_access_reviews enable row level security;

drop policy if exists "Admins can manage admin access reviews" on public.admin_access_reviews;
create policy "Admins can manage admin access reviews"
  on public.admin_access_reviews
  for all
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Service role can manage admin access reviews" on public.admin_access_reviews;
create policy "Service role can manage admin access reviews"
  on public.admin_access_reviews
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
