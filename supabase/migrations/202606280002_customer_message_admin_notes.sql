alter table public.customer_messages
  add column if not exists admin_note text,
  add column if not exists admin_note_updated_at timestamptz,
  add column if not exists resolved_at timestamptz;

create index if not exists customer_messages_status_created_idx
  on public.customer_messages(status, created_at desc);
