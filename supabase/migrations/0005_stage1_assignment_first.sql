-- Stage 1 assignment-first intake (see retainwrite-stage1-intake-spec.md)

do $$ begin
  create type assignment_file_kind as enum ('file', 'paste', 'link');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type extraction_method as enum ('pdf_text', 'docx', 'ocr', 'paste', 'fetch', 'manual');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type intake_question_kind as enum (
    'interest', 'coaching', 'background', 'personal', 'fallback_voice', 'lead_followup'
  );
exception when duplicate_object then null;
end $$;

create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null unique references papers on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  raw_text text not null default '',
  requirements jsonb not null default '{}',
  parse_meta jsonb not null default '{}',
  field_confirmations jsonb not null default '{}',
  confirmed_at timestamptz,
  ai_policy_ack_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists assignment_files (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments on delete cascade,
  paper_id uuid not null references papers on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  kind assignment_file_kind not null,
  filename text,
  mime text,
  byte_size int,
  storage_path text,
  url text,
  extracted_text text,
  extraction_method extraction_method,
  ocr_used boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists intake_answers (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references papers on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  sequence int not null,
  question_id text not null,
  question_text text not null,
  question_kind intake_question_kind not null,
  answer_text text not null default '',
  word_count int not null default 0,
  is_voice_sample boolean not null default false,
  decision text,
  metadata jsonb not null default '{}',
  started_at timestamptz,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists research_leads (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references papers on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  name text,
  why_assignment text,
  why_interest text,
  resource_type text,
  url text,
  search_terms text,
  status text not null default 'to_verify',
  steered_by text not null default 'assignment',
  source text not null default 'intake_suggestion',
  dropped_reason text,
  created_at timestamptz not null default now()
);

create table if not exists interest_profiles (
  user_id uuid primary key references auth.users on delete cascade,
  tags text[] not null default '{}',
  raw_answers jsonb not null default '[]',
  people_mentioned jsonb not null default '[]',
  notes text,
  skipped boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table style_profiles
  add column if not exists sentence_length_variance numeric,
  add column if not exists scholarly_register_score numeric,
  add column if not exists tone_markers jsonb not null default '[]',
  add column if not exists source text;

alter table voice_profiles
  add column if not exists source text,
  add column if not exists word_count int;

create index if not exists intake_answers_paper_sequence_idx on intake_answers (paper_id, sequence);
create index if not exists research_leads_paper_status_idx on research_leads (paper_id, status);
create index if not exists assignment_files_assignment_idx on assignment_files (assignment_id);

create or replace function public.set_assignments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists assignments_updated_at on assignments;
create trigger assignments_updated_at
  before update on assignments
  for each row execute function public.set_assignments_updated_at();

alter table assignments enable row level security;
alter table assignment_files enable row level security;
alter table intake_answers enable row level security;
alter table research_leads enable row level security;
alter table interest_profiles enable row level security;

drop policy if exists "assignments_own" on assignments;
create policy "assignments_own" on assignments for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "assignment_files_own" on assignment_files;
create policy "assignment_files_own" on assignment_files for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "intake_answers_own" on intake_answers;
create policy "intake_answers_own" on intake_answers for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "research_leads_own" on research_leads;
create policy "research_leads_own" on research_leads for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "interest_profiles_own" on interest_profiles;
create policy "interest_profiles_own" on interest_profiles for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
