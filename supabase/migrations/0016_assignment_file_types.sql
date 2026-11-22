-- Stage 1 accepts more assignment formats (see lib/assignment/file-types.ts).
-- Private bucket; uploads still go through owner-only signed URLs.
update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.oasis.opendocument.text',
  'application/rtf',
  'text/rtf',
  'application/vnd.apple.pages',
  'application/x-iwork-pages-sffpages',
  'text/plain',
  'text/markdown',
  'text/x-markdown',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/gif'
]
where id = 'assignment-files';
