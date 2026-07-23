update storage.buckets
set allowed_mime_types = array[
  'video/mp4',
  'image/png',
  'image/jpeg',
  'image/webp'
]
where id = 'videos';
