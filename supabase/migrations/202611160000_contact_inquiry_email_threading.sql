alter table public.contact_inquiry_replies
  add column if not exists email_message_id text;

create unique index if not exists contact_inquiry_replies_email_message_id_idx
  on public.contact_inquiry_replies(email_message_id)
  where email_message_id is not null;
