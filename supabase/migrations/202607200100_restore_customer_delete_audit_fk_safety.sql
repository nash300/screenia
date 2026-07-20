create or replace function public.audit_table_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_customer_id uuid;
  changed_record_id text;
  actor_id text;
begin
  if TG_OP = 'DELETE' then
    changed_record_id := old.id::text;

    -- Parent and child rows can be deleted in one cascade. Preserve customer
    -- identity in the old-row metadata without retaining an unsafe foreign key.
    changed_customer_id := null;
  else
    changed_record_id := new.id::text;

    if TG_ARGV[0] = 'id' then
      changed_customer_id := new.id;
    elsif TG_ARGV[0] = 'customer_id' then
      changed_customer_id := new.customer_id;
    else
      changed_customer_id := null;
    end if;
  end if;

  actor_id := nullif(auth.uid()::text, '');

  insert into public.audit_events (
    customer_id,
    actor_type,
    actor_id,
    event_type,
    event_description,
    metadata
  )
  values (
    changed_customer_id,
    'system',
    actor_id,
    lower(TG_TABLE_NAME || '_' || TG_OP),
    TG_TABLE_NAME || ' record ' || lower(TG_OP),
    jsonb_build_object(
      'table', TG_TABLE_NAME,
      'operation', TG_OP,
      'recordId', changed_record_id,
      'old', case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
      'new', case when TG_OP in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
    )
  );

  if TG_OP = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;
