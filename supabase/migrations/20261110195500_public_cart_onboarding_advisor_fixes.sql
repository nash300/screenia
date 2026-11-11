create index if not exists checkout_orders_cart_idx
  on public.checkout_orders(cart_id);

create index if not exists checkout_orders_customer_subscription_idx
  on public.checkout_orders(customer_subscription_id);

drop policy if exists "Admins read checkout carts" on public.checkout_carts;
create policy "Admins read checkout carts"
  on public.checkout_carts
  for select
  to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins read checkout orders" on public.checkout_orders;
create policy "Admins read checkout orders"
  on public.checkout_orders
  for select
  to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
