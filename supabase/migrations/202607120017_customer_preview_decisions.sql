create table if not exists public.customer_preview_decisions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  subscription_id uuid references public.customer_subscriptions(id) on delete set null,
  preview_url text,
  decision text not null check (decision in ('approved', 'changes_requested')),
  feedback text,
  decided_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists customer_preview_decisions_customer_decided_idx
  on public.customer_preview_decisions(customer_id, decided_at desc);

create index if not exists customer_preview_decisions_subscription_idx
  on public.customer_preview_decisions(subscription_id);

alter table public.customer_preview_decisions enable row level security;

drop policy if exists "Customers can read their own preview decisions"
  on public.customer_preview_decisions;
create policy "Customers can read their own preview decisions"
  on public.customer_preview_decisions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.customers
      where customers.id = customer_preview_decisions.customer_id
        and customers.auth_user_id = auth.uid()
    )
  );

drop policy if exists "Admins can read preview decisions"
  on public.customer_preview_decisions;
create policy "Admins can read preview decisions"
  on public.customer_preview_decisions
  for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Service role can manage preview decisions"
  on public.customer_preview_decisions;
create policy "Service role can manage preview decisions"
  on public.customer_preview_decisions
  for all
  to service_role
  using (true)
  with check (true);
