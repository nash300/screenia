create table if not exists public.landing_hero_slides (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  title text not null check (char_length(title) between 1 and 220),
  body text not null default '' check (char_length(body) <= 1000),
  highlight_terms text[] not null default '{}',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.landing_hero_benefits (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '' check (char_length(body) <= 280),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists landing_hero_slides_active_order_idx
  on public.landing_hero_slides (is_active, sort_order, created_at);

create index if not exists landing_hero_benefits_active_order_idx
  on public.landing_hero_benefits (is_active, sort_order, created_at);

alter table if exists public.landing_hero_slides
  add column if not exists highlight_terms text[] not null default '{}';

alter table public.landing_hero_slides enable row level security;
alter table public.landing_hero_benefits enable row level security;

drop policy if exists "Public can read active landing hero slides" on public.landing_hero_slides;
create policy "Public can read active landing hero slides"
  on public.landing_hero_slides
  for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists "Admins can manage landing hero slides" on public.landing_hero_slides;
create policy "Admins can manage landing hero slides"
  on public.landing_hero_slides
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Public can read active landing hero benefits" on public.landing_hero_benefits;
create policy "Public can read active landing hero benefits"
  on public.landing_hero_benefits
  for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists "Admins can manage landing hero benefits" on public.landing_hero_benefits;
create policy "Admins can manage landing hero benefits"
  on public.landing_hero_benefits
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'landing-media',
  'landing-media',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read landing media" on storage.objects;
create policy "Public can read landing media"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'landing-media');

drop policy if exists "Admins can manage landing media" on storage.objects;
create policy "Admins can manage landing media"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'landing-media' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check (bucket_id = 'landing-media' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

insert into public.landing_hero_slides (image_url, title, body, sort_order, is_active)
select *
from (
  values
    ('/landing/hero-slides/01/image.png', 'Förvandla förbipasserande till kunder', 'Visa det som gör ditt företag unikt och locka fler besökare att komma in.', 1, true),
    ('/landing/hero-slides/02/image.png', 'Din befintliga skärm är allt som behövs', 'Vår lösning fungerar med både TV-apparater och professionella skyltskärmar i olika storlekar.', 2, true),
    ('/landing/hero-slides/03/image.png', 'Slipp dyra installationer och komplicerade system', 'Använd din befintliga TV och börja marknadsföra ditt företag på några minuter. Enkelt, prisvärt och anpassat för småföretag.', 3, true)
) as defaults(image_url, title, body, sort_order, is_active)
where not exists (select 1 from public.landing_hero_slides);

insert into public.landing_hero_benefits (title, body, sort_order, is_active)
select *
from (
  values
    ('Ingen bindningstid', 'Avsluta när som helst.', 1, true),
    ('Kostnadsfri provperiod', 'Tre veckor utan kostnad.', 2, true),
    ('Alla HDMI-skärmar', 'Smart TV och professionell signage.', 3, true),
    ('100 % nöjdhetsgaranti', 'Trygg start med Screenia.', 4, true)
) as defaults(title, body, sort_order, is_active)
where not exists (select 1 from public.landing_hero_benefits);

update public.landing_hero_slides
set highlight_terms = case sort_order
  when 1 then array['kunder', 'unikt', 'fler besÃ¶kare']
  when 2 then array['befintliga skÃ¤rm', 'allt som behÃ¶vs']
  when 3 then array['Slipp dyra installationer', 'Enkelt', 'prisvÃ¤rt']
  else highlight_terms
end
where highlight_terms = '{}';

drop trigger if exists set_updated_at on public.landing_hero_slides;
create trigger set_updated_at
  before update on public.landing_hero_slides
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.landing_hero_benefits;
create trigger set_updated_at
  before update on public.landing_hero_benefits
  for each row execute function public.set_updated_at();
