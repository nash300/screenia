create table if not exists public.contact_inquiries (
  id uuid primary key default gen_random_uuid(),
  case_number text not null unique,
  name text not null,
  email text not null,
  company_name text,
  subject text not null,
  message text not null,
  status text not null default 'new',
  privacy_accepted_at timestamptz not null,
  confirmation_email_id text,
  confirmation_email_status text not null default 'pending',
  admin_notification_email_id text,
  admin_notification_email_status text not null default 'pending',
  first_opened_at timestamptz,
  closed_at timestamptz,
  closed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contact_inquiries_status_check
    check (status in ('new', 'open', 'replied', 'closed')),
  constraint contact_inquiries_confirmation_status_check
    check (confirmation_email_status in ('pending', 'sent', 'failed')),
  constraint contact_inquiries_admin_email_status_check
    check (admin_notification_email_status in ('pending', 'sent', 'failed'))
);

create table if not exists public.contact_inquiry_replies (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.contact_inquiries(id) on delete cascade,
  admin_user_id uuid references auth.users(id) on delete set null,
  message text not null,
  email_id text,
  email_status text not null default 'pending',
  created_at timestamptz not null default now(),
  constraint contact_inquiry_replies_email_status_check
    check (email_status in ('pending', 'sent', 'failed'))
);

create index if not exists contact_inquiries_status_created_idx
  on public.contact_inquiries(status, created_at desc);
create index if not exists contact_inquiries_email_created_idx
  on public.contact_inquiries(lower(email), created_at desc);
create index if not exists contact_inquiry_replies_inquiry_created_idx
  on public.contact_inquiry_replies(inquiry_id, created_at asc);

drop trigger if exists set_updated_at on public.contact_inquiries;
create trigger set_updated_at
  before update on public.contact_inquiries
  for each row execute function public.set_updated_at();

alter table public.contact_inquiries enable row level security;
alter table public.contact_inquiry_replies enable row level security;

drop policy if exists "Authenticated admins can read contact inquiries" on public.contact_inquiries;
create policy "Authenticated admins can read contact inquiries"
  on public.contact_inquiries
  for select
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Authenticated admins can update contact inquiries" on public.contact_inquiries;
create policy "Authenticated admins can update contact inquiries"
  on public.contact_inquiries
  for update
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Authenticated admins can read contact replies" on public.contact_inquiry_replies;
create policy "Authenticated admins can read contact replies"
  on public.contact_inquiry_replies
  for select
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Service role can manage contact inquiries" on public.contact_inquiries;
create policy "Service role can manage contact inquiries"
  on public.contact_inquiries
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role can manage contact replies" on public.contact_inquiry_replies;
create policy "Service role can manage contact replies"
  on public.contact_inquiry_replies
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
