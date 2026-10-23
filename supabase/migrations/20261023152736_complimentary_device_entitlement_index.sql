create index if not exists devices_complimentary_granted_by_idx
  on public.devices(complimentary_granted_by)
  where complimentary_granted_by is not null;
