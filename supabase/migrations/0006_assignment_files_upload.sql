-- Stage 1 upload path: richer assignment_files + private bucket (spec §9 / §10)

do $$ begin
  create type assignment_upload_status as enum ('pending', 'uploading', 'ready', 'processing', 'failed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type assignment_parse_status as enum (
    'idle', 'extracting', 'ocr', 'merging', 'extracting_requirements',
    'ready', 'needs_input', 'failed'
  );
exception when duplicate_object then null;
end $$;

-- Widen extraction_method for OCR providers (additive labels)
do $$ begin
  alter type extraction_method add value 'txt';
exception when duplicate_object then null;
end $$;

do $$ begin
  alter type extraction_method add value 'ocr_mistral';
exception when duplicate_object then null;
end $$;

do $$ begin
  alter type extraction_method add value 'ocr_grok_vision';
exception when duplicate_object then null;
end $$;

alter table assignments
  add column if not exists parse_status assignment_parse_status not null default 'idle',
  add column if not exists files_delete_after timestamptz;

alter table assignment_files
  add column if not exists pages int,
  add column if not exists page_meta jsonb not null default '[]',
  add column if not exists ocr_method text,
  add column if not exists ocr_confidence numeric,
  add column if not exists quality_score numeric,
  add column if not exists sort_order int not null default 0,
  add column if not exists content_hash text,
  add column if not exists upload_status assignment_upload_status not null default 'pending',
  add column if not exists exif_stripped boolean not null default false;

-- Private storage bucket for assignment uploads (signed URLs only)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'assignment-files',
  'assignment-files',
  false,
  26214400,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'image/gif'
  ]
)
on conflict (id) do nothing;

drop policy if exists "assignment_files_select_own" on storage.objects;
create policy "assignment_files_select_own"
  on storage.objects for select
  using (
    bucket_id = 'assignment-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "assignment_files_insert_own" on storage.objects;
create policy "assignment_files_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'assignment-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "assignment_files_update_own" on storage.objects;
create policy "assignment_files_update_own"
  on storage.objects for update
  using (
    bucket_id = 'assignment-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "assignment_files_delete_own" on storage.objects;
create policy "assignment_files_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'assignment-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
