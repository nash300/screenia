alter table public.customers
  add column if not exists auth_user_id uuid unique;

create index if not exists customers_auth_user_id_idx
  on public.customers(auth_user_id);

create table if not exists public.customer_messages (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  subject text,
  message text not null,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_messages_customer_id_idx
  on public.customer_messages(customer_id, created_at desc);

create table if not exists public.customer_message_files (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.customer_messages(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  file_name text not null,
  content_type text not null,
  file_size integer not null,
  storage_bucket text not null default 'customer-message-files',
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists customer_message_files_customer_id_idx
  on public.customer_message_files(customer_id, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'customer-message-files',
  'customer-message-files',
  false,
  20971520,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'application/pdf',
    'text/plain'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.customer_messages enable row level security;
alter table public.customer_message_files enable row level security;

drop policy if exists "Authenticated admins can manage customer messages" on public.customer_messages;
create policy "Authenticated admins can manage customer messages"
  on public.customer_messages
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Service role can manage customer messages" on public.customer_messages;
create policy "Service role can manage customer messages"
  on public.customer_messages
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Authenticated admins can manage customer message files" on public.customer_message_files;
create policy "Authenticated admins can manage customer message files"
  on public.customer_message_files
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Service role can manage customer message files" on public.customer_message_files;
create policy "Service role can manage customer message files"
  on public.customer_message_files
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Authenticated admins can read customer message files" on storage.objects;
create policy "Authenticated admins can read customer message files"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'customer-message-files' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Service role can manage customer message file objects" on storage.objects;
create policy "Service role can manage customer message file objects"
  on storage.objects
  for all
  to service_role
  using (bucket_id = 'customer-message-files')
  with check (bucket_id = 'customer-message-files');
