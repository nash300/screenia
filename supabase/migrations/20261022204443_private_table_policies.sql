-- Make the service-role-only intent explicit for private operational tables.
create policy "Service role can manage customer legal agreements"
  on public.customer_legal_agreements
  for all
  to service_role
  using (true)
  with check (true);

create policy "Service role can manage legal documents"
  on public.legal_documents
  for all
  to service_role
  using (true)
  with check (true);

create policy "Service role can manage security rate limits"
  on public.security_rate_limits
  for all
  to service_role
  using (true)
  with check (true);
