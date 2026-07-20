with ranked as (
  select
    id,
    row_number() over (
      partition by customer_id, event_type, metadata->>'invoiceId'
      order by created_at asc, id asc
    ) as row_number
  from public.audit_events
  where event_type in ('subscription_invoice_paid', 'subscription_invoice_email_sent')
    and nullif(metadata->>'invoiceId', '') is not null
)
delete from public.audit_events
where id in (select id from ranked where row_number > 1);

update public.audit_events
set dedupe_key = event_type || ':' || (metadata->>'invoiceId') || ':' || coalesce(customer_id::text, 'none')
where event_type in ('subscription_invoice_paid', 'subscription_invoice_email_sent')
  and nullif(metadata->>'invoiceId', '') is not null
  and dedupe_key is null;

