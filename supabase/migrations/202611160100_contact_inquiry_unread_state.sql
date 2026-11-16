alter table public.contact_inquiries
  add column if not exists admin_unread_at timestamptz;

create index if not exists contact_inquiries_admin_unread_idx
  on public.contact_inquiries(admin_unread_at)
  where admin_unread_at is not null;

update public.contact_inquiries
set admin_unread_at = coalesce(first_opened_at, created_at)
where status = 'new' and admin_unread_at is null;
