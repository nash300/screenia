update public.audit_events
set
  event_type = 'payment_dispute_lost',
  event_description = 'Stripe reported a lost payment dispute. Customer display access remains blocked.'
where event_type = 'payment_disputed'
  and metadata->>'disputeStatus' = 'lost';

update public.admin_notifications
set
  event_type = 'payment_dispute_lost',
  title = 'Payment dispute lost',
  message = 'Stripe marked dispute ' || (metadata->>'disputeId') || ' as lost. Display access remains blocked.'
where event_type = 'payment_disputed'
  and metadata->>'disputeStatus' = 'lost';

with ranked as (
  select
    id,
    row_number() over (
      partition by event_type, metadata->>'disputeId', metadata->>'disputeStatus'
      order by created_at asc, id asc
    ) as row_number
  from public.audit_events
  where event_type in ('payment_disputed', 'payment_dispute_won', 'payment_dispute_lost')
    and nullif(metadata->>'disputeId', '') is not null
    and nullif(metadata->>'disputeStatus', '') is not null
)
delete from public.audit_events
where id in (select id from ranked where row_number > 1);

with ranked as (
  select
    id,
    row_number() over (
      partition by event_type, metadata->>'disputeId', metadata->>'disputeStatus'
      order by created_at asc, id asc
    ) as row_number
  from public.admin_notifications
  where event_type in ('payment_disputed', 'payment_dispute_won', 'payment_dispute_lost')
    and nullif(metadata->>'disputeId', '') is not null
    and nullif(metadata->>'disputeStatus', '') is not null
)
delete from public.admin_notifications
where id in (select id from ranked where row_number > 1);

update public.audit_events
set dedupe_key = 'stripe_dispute:' || (metadata->>'disputeId') || ':' || (metadata->>'disputeStatus')
where event_type in ('payment_disputed', 'payment_dispute_won', 'payment_dispute_lost')
  and nullif(metadata->>'disputeId', '') is not null
  and nullif(metadata->>'disputeStatus', '') is not null
  and dedupe_key is null;

update public.admin_notifications
set dedupe_key = 'stripe_dispute:' || (metadata->>'disputeId') || ':' || (metadata->>'disputeStatus')
where event_type in ('payment_disputed', 'payment_dispute_won', 'payment_dispute_lost')
  and nullif(metadata->>'disputeId', '') is not null
  and nullif(metadata->>'disputeStatus', '') is not null
  and dedupe_key is null;
