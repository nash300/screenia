create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table public.playlists
  add column if not exists video_id uuid references public.videos(id) on delete set null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists playlists_device_order_idx
  on public.playlists(device_id, order_index);

drop trigger if exists set_updated_at on public.playlists;
create trigger set_updated_at
  before update on public.playlists
  for each row execute function public.set_updated_at();
