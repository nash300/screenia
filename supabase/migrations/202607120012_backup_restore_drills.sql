create table if not exists public.backup_restore_drills (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  backup_scope text not null,
  status text not null default 'planned',
  last_successful_backup_at timestamptz,
  restore_tested_at timestamptz,
  evidence_reference text,
  notes text,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint backup_restore_drills_status_check
    check (status in ('planned', 'backup_verified', 'restore_tested', 'needs_attention'))
);

create index if not exists idx_backup_restore_drills_status
  on public.backup_restore_drills(status);

create index if not exists idx_backup_restore_drills_provider
  on public.backup_restore_drills(lower(provider));

alter table public.backup_restore_drills enable row level security;

drop policy if exists "Admins can manage backup restore drills"
  on public.backup_restore_drills;
create policy "Admins can manage backup restore drills"
  on public.backup_restore_drills
  for all
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Service role can manage backup restore drills"
  on public.backup_restore_drills;
create policy "Service role can manage backup restore drills"
  on public.backup_restore_drills
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
