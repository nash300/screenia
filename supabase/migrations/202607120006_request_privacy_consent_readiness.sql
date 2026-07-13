create or replace function public.screenia_request_privacy_consent_ready(
  required_privacy_version text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'consent_records'
        and column_name = 'consent_type'
    )
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'consent_records'
        and column_name = 'document_version'
    )
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'consent_records'
        and column_name = 'collection_point'
    )
    and not exists (
      select 1
      from public.customers customer
      where customer.status = 'new_request'
        and not exists (
          select 1
          from public.consent_records consent
          where consent.customer_id = customer.id
            and consent.consent_type = 'privacy_request'
            and consent.granted = true
            and consent.document_version = required_privacy_version
            and consent.collection_point = 'landing_request_form'
        )
    );
$$;
