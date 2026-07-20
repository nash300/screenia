alter table public.audit_events
  add column if not exists dedupe_key text;

alter table public.admin_notifications
  add column if not exists dedupe_key text;

with ranked as (
  select
    id,
    row_number() over (
      partition by metadata->>'invoiceId'
      order by created_at asc, id asc
    ) as row_number
  from public.audit_events
  where event_type = 'payment_failed'
    and nullif(metadata->>'invoiceId', '') is not null
)
delete from public.audit_events
where id in (select id from ranked where row_number > 1);

with ranked as (
  select
    id,
    row_number() over (
      partition by metadata->>'invoiceId'
      order by created_at asc, id asc
    ) as row_number
  from public.admin_notifications
  where event_type = 'payment_failed'
    and nullif(metadata->>'invoiceId', '') is not null
)
delete from public.admin_notifications
where id in (select id from ranked where row_number > 1);

update public.audit_events
set dedupe_key = 'payment_failed:' || (metadata->>'invoiceId')
where event_type = 'payment_failed'
  and nullif(metadata->>'invoiceId', '') is not null
  and dedupe_key is null;

update public.admin_notifications
set dedupe_key = 'payment_failed:' || (metadata->>'invoiceId')
where event_type = 'payment_failed'
  and nullif(metadata->>'invoiceId', '') is not null
  and dedupe_key is null;

create unique index if not exists idx_audit_events_dedupe_key
  on public.audit_events(dedupe_key)
  where dedupe_key is not null;

create unique index if not exists idx_admin_notifications_dedupe_key
  on public.admin_notifications(dedupe_key)
  where dedupe_key is not null;

