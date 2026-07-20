create table if not exists public.customer_refund_cases (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  customer_subscription_id uuid references public.customer_subscriptions(id) on delete set null,
  order_number text,
  request_type text not null,
  requested_amount_ore bigint not null,
  approved_amount_ore bigint,
  currency text not null default 'sek',
  customer_reason text not null,
  admin_decision text not null default 'pending',
  admin_reason text,
  status text not null default 'open',
  stripe_payment_intent_id text,
  stripe_refund_id text,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_refund_cases_request_type_check
    check (request_type in ('full', 'partial')),
  constraint customer_refund_cases_amount_check
    check (
      requested_amount_ore > 0
      and (approved_amount_ore is null or approved_amount_ore > 0)
      and (approved_amount_ore is null or approved_amount_ore <= requested_amount_ore)
    ),
  constraint customer_refund_cases_decision_check
    check (admin_decision in ('pending', 'denied', 'approved_partial', 'approved_full')),
  constraint customer_refund_cases_status_check
    check (status in ('open', 'closed'))
);

create index if not exists customer_refund_cases_customer_idx
  on public.customer_refund_cases(customer_id, requested_at desc);

create index if not exists customer_refund_cases_subscription_idx
  on public.customer_refund_cases(customer_subscription_id, requested_at desc);

alter table public.customer_refund_cases enable row level security;

drop policy if exists "Authenticated admins can manage customer refund cases"
  on public.customer_refund_cases;

create policy "Authenticated admins can manage customer refund cases"
  on public.customer_refund_cases
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop trigger if exists set_customer_refund_cases_updated_at
  on public.customer_refund_cases;

create trigger set_customer_refund_cases_updated_at
before update on public.customer_refund_cases
for each row execute function public.set_updated_at();
