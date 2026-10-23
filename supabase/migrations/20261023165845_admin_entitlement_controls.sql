alter table public.devices
  add column if not exists complimentary_expires_at timestamptz,
  add column if not exists replacement_for_device_id text references public.devices(id) on delete set null,
  add column if not exists is_loaner boolean not null default false,
  add column if not exists loaner_due_at timestamptz;

comment on column public.devices.complimentary_expires_at is
  'When a complimentary screen stops being an active owner-approved exception.';

comment on column public.devices.replacement_for_device_id is
  'The previous display endpoint replaced by this device allocation.';

comment on column public.devices.is_loaner is
  'Whether this device is temporary hardware provided while another display is unavailable.';

comment on column public.devices.loaner_due_at is
  'Expected return or review date for temporary loaner hardware.';

alter table public.devices
  drop constraint if exists devices_loaner_due_check,
  add constraint devices_loaner_due_check
  check (not is_loaner or loaner_due_at is not null),
  drop constraint if exists devices_replacement_self_check,
  add constraint devices_replacement_self_check
  check (replacement_for_device_id is null or replacement_for_device_id <> id);

create index if not exists devices_complimentary_expiry_idx
  on public.devices(complimentary_expires_at)
  where is_complimentary = true and is_active = true;

create index if not exists devices_replacement_for_idx
  on public.devices(replacement_for_device_id)
  where replacement_for_device_id is not null;

create index if not exists devices_loaner_due_idx
  on public.devices(loaner_due_at)
  where is_loaner = true and is_active = true;
