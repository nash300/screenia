create table if not exists public.admin_operation_test_evidence (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.admin_operation_test_runs(id) on delete cascade,
  scenario_key text not null,
  moment_key text not null,
  moment_order smallint not null,
  caption text not null,
  storage_bucket text not null default 'admin-test-evidence',
  storage_path text not null unique,
  mime_type text not null,
  file_size integer not null,
  captured_by uuid references auth.users(id) on delete set null,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint admin_operation_test_evidence_scenario_check
    check (scenario_key ~ '^OPS-[0-9]{3}$'),
  constraint admin_operation_test_evidence_moment_key_check
    check (moment_key ~ '^[a-z0-9-]{3,60}$'),
  constraint admin_operation_test_evidence_moment_order_check
    check (moment_order between 1 and 20),
  constraint admin_operation_test_evidence_caption_check
    check (char_length(trim(caption)) between 10 and 500),
  constraint admin_operation_test_evidence_file_size_check
    check (file_size between 1 and 8388608),
  constraint admin_operation_test_evidence_mime_check
    check (mime_type in ('image/png', 'image/jpeg', 'image/webp'))
);

create index if not exists idx_admin_operation_test_evidence_run_scenario
  on public.admin_operation_test_evidence(run_id, scenario_key, moment_order, captured_at);

alter table public.admin_operation_test_evidence enable row level security;

drop policy if exists "Admins can read operation test evidence"
  on public.admin_operation_test_evidence;
create policy "Admins can read operation test evidence"
  on public.admin_operation_test_evidence
  for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Service role can manage operation test evidence"
  on public.admin_operation_test_evidence;
create policy "Service role can manage operation test evidence"
  on public.admin_operation_test_evidence
  for all
  to service_role
  using (true)
  with check (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'admin-test-evidence',
  'admin-test-evidence',
  false,
  8388608,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins can read operation test evidence objects"
  on storage.objects;
create policy "Admins can read operation test evidence objects"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'admin-test-evidence'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

drop policy if exists "Service role can manage operation test evidence objects"
  on storage.objects;
create policy "Service role can manage operation test evidence objects"
  on storage.objects
  for all
  to service_role
  using (bucket_id = 'admin-test-evidence')
  with check (bucket_id = 'admin-test-evidence');
