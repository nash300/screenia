update storage.buckets
set public = false
where id in (
  'videos',
  'customer-display-assets',
  'customer-message-files'
);

drop policy if exists "Public can read video objects" on storage.objects;
drop policy if exists "Public can read customer display asset objects" on storage.objects;
drop policy if exists "Public can read customer message file objects" on storage.objects;

-- Sensitive customer uploads must be served through audited server routes that
-- verify account/admin/display entitlement and return short-lived signed URLs.
