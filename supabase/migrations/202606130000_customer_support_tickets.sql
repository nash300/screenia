alter table public.customer_messages
  add column if not exists ticket_number text,
  add column if not exists request_type text not null default 'general',
  add column if not exists priority text not null default 'normal',
  add column if not exists related_ticket_number text;

create index if not exists customer_messages_ticket_number_idx
  on public.customer_messages(ticket_number, created_at desc)
  where ticket_number is not null;

create index if not exists customer_messages_request_type_idx
  on public.customer_messages(request_type, created_at desc);

create index if not exists customer_messages_related_ticket_idx
  on public.customer_messages(related_ticket_number, created_at desc)
  where related_ticket_number is not null;
