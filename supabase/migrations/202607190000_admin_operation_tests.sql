create table if not exists public.admin_operation_test_runs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  environment text not null default 'test',
  status text not null default 'active',
  notes text,
  started_by uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_operation_test_runs_name_check
    check (char_length(trim(name)) between 3 and 120),
  constraint admin_operation_test_runs_environment_check
    check (environment in ('local', 'test', 'production_test', 'live')),
  constraint admin_operation_test_runs_status_check
    check (status in ('active', 'completed', 'aborted'))
);

create table if not exists public.admin_operation_test_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.admin_operation_test_runs(id) on delete cascade,
  scenario_key text not null,
  status text not null,
  evidence_notes text,
  external_references jsonb not null default '{}'::jsonb,
  tested_by uuid references auth.users(id) on delete set null,
  tested_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_operation_test_results_scenario_check
    check (scenario_key ~ '^OPS-[0-9]{3}$'),
  constraint admin_operation_test_results_status_check
    check (status in ('in_progress', 'passed', 'failed', 'blocked')),
  constraint admin_operation_test_results_evidence_check
    check (
      status = 'in_progress'
      or char_length(trim(coalesce(evidence_notes, ''))) >= 10
    ),
  constraint admin_operation_test_results_run_scenario_unique
    unique (run_id, scenario_key)
);

create index if not exists idx_admin_operation_test_runs_started
  on public.admin_operation_test_runs(started_at desc);

create index if not exists idx_admin_operation_test_runs_status
  on public.admin_operation_test_runs(status);

create index if not exists idx_admin_operation_test_results_run_status
  on public.admin_operation_test_results(run_id, status);

drop trigger if exists set_updated_at on public.admin_operation_test_runs;
create trigger set_updated_at
  before update on public.admin_operation_test_runs
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.admin_operation_test_results;
create trigger set_updated_at
  before update on public.admin_operation_test_results
  for each row execute function public.set_updated_at();

alter table public.admin_operation_test_runs enable row level security;
alter table public.admin_operation_test_results enable row level security;

drop policy if exists "Admins can manage operation test runs"
  on public.admin_operation_test_runs;
create policy "Admins can manage operation test runs"
  on public.admin_operation_test_runs
  for all
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Service role can manage operation test runs"
  on public.admin_operation_test_runs;
create policy "Service role can manage operation test runs"
  on public.admin_operation_test_runs
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Admins can manage operation test results"
  on public.admin_operation_test_results;
create policy "Admins can manage operation test results"
  on public.admin_operation_test_results
  for all
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Service role can manage operation test results"
  on public.admin_operation_test_results;
create policy "Service role can manage operation test results"
  on public.admin_operation_test_results
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
