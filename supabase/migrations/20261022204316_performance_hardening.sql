-- Add covering indexes for foreign keys flagged by Supabase advisors.
create index if not exists idx_contact_inquiries_closed_by
  on public.contact_inquiries(closed_by);
create index if not exists idx_contact_inquiry_replies_admin_user_id
  on public.contact_inquiry_replies(admin_user_id);
create index if not exists idx_customer_legal_agreements_legal_document_id
  on public.customer_legal_agreements(legal_document_id);
create index if not exists idx_customer_message_files_message_id
  on public.customer_message_files(message_id);
create index if not exists idx_customer_messages_reply_to_message_id
  on public.customer_messages(reply_to_message_id);
create index if not exists idx_customer_messages_sender_user_id
  on public.customer_messages(sender_user_id);
create index if not exists idx_customer_subscriptions_pricing_plan_id
  on public.customer_subscriptions(pricing_plan_id);
create index if not exists idx_data_subject_requests_source_message_id
  on public.data_subject_requests(source_message_id);
create index if not exists idx_inventory_events_customer_id
  on public.inventory_events(customer_id);
create index if not exists idx_inventory_events_device_id
  on public.inventory_events(device_id);
create index if not exists idx_playlists_video_id
  on public.playlists(video_id);
create index if not exists idx_subscription_adjustments_customer_id
  on public.subscription_adjustments(customer_id);
create index if not exists idx_subscription_adjustments_subscription_id
  on public.subscription_adjustments(customer_subscription_id);
create index if not exists idx_subscription_device_cancellations_subscription_id
  on public.subscription_device_cancellations(customer_subscription_id);
create index if not exists idx_subscription_device_pauses_subscription_id
  on public.subscription_device_pauses(customer_subscription_id);
create index if not exists idx_videos_customer_id
  on public.videos(customer_id);

-- Keep one copy of the due-date index on subscription_device_pauses.
drop index if exists public.subscription_device_pauses_due_idx;

-- Service-role policy predicates are redundant after policy roles are explicit.
-- Removing them avoids evaluating auth.role() for every row.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and policyname like 'Service role %'
  loop
    if policy_record.qual is not null and policy_record.cmd <> 'INSERT' then
      execute format(
        'alter policy %I on %I.%I using (true)',
        policy_record.policyname,
        policy_record.schemaname,
        policy_record.tablename
      );
    end if;
    if policy_record.with_check is not null
      and policy_record.cmd in ('ALL', 'INSERT', 'UPDATE')
    then
      execute format(
        'alter policy %I on %I.%I with check (true)',
        policy_record.policyname,
        policy_record.schemaname,
        policy_record.tablename
      );
    end if;
  end loop;
end;
$$;

-- Evaluate auth helpers once per statement instead of once per row in RLS
-- policies. This preserves the existing authorization predicates.
do $$
declare
  policy_record record;
  rewritten text;
begin
  for policy_record in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (qual like '%auth.%' or with_check like '%auth.%')
  loop
    if policy_record.qual is not null then
      rewritten := replace(policy_record.qual, 'auth.uid()', '(select auth.uid())');
      rewritten := replace(rewritten, 'auth.jwt()', '(select auth.jwt())');
      rewritten := replace(rewritten, 'auth.role()', '(select auth.role())');
      if rewritten <> policy_record.qual then
        execute format(
          'alter policy %I on %I.%I using %s',
          policy_record.policyname,
          policy_record.schemaname,
          policy_record.tablename,
          rewritten
        );
      end if;
    end if;
    if policy_record.with_check is not null then
      rewritten := replace(policy_record.with_check, 'auth.uid()', '(select auth.uid())');
      rewritten := replace(rewritten, 'auth.jwt()', '(select auth.jwt())');
      rewritten := replace(rewritten, 'auth.role()', '(select auth.role())');
      if rewritten <> policy_record.with_check then
        execute format(
          'alter policy %I on %I.%I with check %s',
          policy_record.policyname,
          policy_record.schemaname,
          policy_record.tablename,
          rewritten
        );
      end if;
    end if;
  end loop;
end;
$$;
