alter table public.devices
  add column if not exists is_complimentary boolean not null default false,
  add column if not exists complimentary_reason text,
  add column if not exists complimentary_granted_at timestamptz,
  add column if not exists complimentary_granted_by uuid references auth.users(id) on delete set null;

comment on column public.devices.is_complimentary is
  'When true, this display is an owner-approved complimentary screen and does not consume a paid screen entitlement.';

comment on column public.devices.complimentary_reason is
  'Required business reason for providing a complimentary screen.';

comment on column public.devices.complimentary_granted_at is
  'Timestamp when the complimentary screen exception was granted.';

comment on column public.devices.complimentary_granted_by is
  'Admin account that granted the complimentary screen exception.';

alter table public.devices
  drop constraint if exists devices_complimentary_reason_check,
  add constraint devices_complimentary_reason_check
  check (
    not is_complimentary
    or length(trim(coalesce(complimentary_reason, ''))) >= 5
  );

create index if not exists devices_complimentary_idx
  on public.devices(customer_id, is_complimentary)
  where is_complimentary = true;

create index if not exists devices_complimentary_granted_by_idx
  on public.devices(complimentary_granted_by)
  where complimentary_granted_by is not null;
