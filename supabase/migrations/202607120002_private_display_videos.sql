update storage.buckets
set public = false
where id = 'videos';

drop policy if exists "Public can read video objects" on storage.objects;

drop policy if exists "Displays can read video objects" on storage.objects;

-- Display playback must go through /api/display/[deviceId]/playlist, where
-- Screenia verifies paid entitlement and returns short-lived signed URLs.
