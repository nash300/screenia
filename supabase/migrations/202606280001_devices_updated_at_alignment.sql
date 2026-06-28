alter table public.devices
  add column if not exists updated_at timestamptz not null default now();

alter table public.playlists
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists set_updated_at on public.devices;
create trigger set_updated_at
  before update on public.devices
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.playlists;
create trigger set_updated_at
  before update on public.playlists
  for each row execute function public.set_updated_at();
