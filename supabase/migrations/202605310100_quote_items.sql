alter table public.customer_subscriptions
  add column if not exists quote_items jsonb not null default '[]'::jsonb;
