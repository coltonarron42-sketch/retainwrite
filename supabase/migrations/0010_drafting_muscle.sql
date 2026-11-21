-- Drafting muscle (S3-t56). 0009 stays reserved.
-- Apply on production project "Retain write" only after 0008_section_loop.sql.
-- Do not add any new schema to Supabase exposed API schemas.

alter table papers add column if not exists paper_genre text not null default 'unknown'
  check (paper_genre in (
    'narrative','personal_experience','reflective','admissions','expository','argumentative',
    'compare_contrast','cause_effect','literary_analysis','rhetorical_analysis','research',
    'case_study','critique','unknown'
  ));
alter table papers add column if not exists paper_genre_source text;

create table if not exists draft_ledgers (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references papers on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  version int not null,
  snapshot jsonb not null,
  source_hash text not null,
  locked_at timestamptz not null default now(),
  superseded_at timestamptz,
  unique (paper_id, version)
);

create table if not exists draft_paragraphs (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references papers on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  section_plan_id uuid references section_plans on delete cascade,
  paragraph_key text not null,
  sort_order int not null,
  kind text not null check (kind in ('intro','body','counter','conclusion')),
  ledger_version int not null,
  ledger_item_ids jsonb not null default '[]',
  loop_step text not null default 'teach'
    check (loop_step in ('teach','reread','drafting','feedback','tighten','revise','saved')),
  status text not null default 'locked'
    check (status in ('locked','open','saved','needs_review')),
  intro_variant text check (intro_variant in ('thesis','story','reflective','case')),
  intro_variant_source text,
  intro_format text,
  rubric_explainers jsonb not null default '[]',
  text text not null default '',
  versions jsonb not null default '[]',
  feedback jsonb,
  feedback_runs int not null default 0,
  connector_sets_shown text[] not null default '{}',
  opener_choice text check (opener_choice in ('shot','breakdown')),
  conclusion_checklist jsonb,
  stall_count int not null default 0,
  paste_meta jsonb not null default '{}',
  rough_at timestamptz,
  saved_at timestamptz,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (paper_id, paragraph_key)
);

create index if not exists draft_paragraphs_paper_sort_idx on draft_paragraphs (paper_id, sort_order);
create index if not exists draft_ledgers_paper_version_idx on draft_ledgers (paper_id, version);

alter table draft_ledgers enable row level security;
alter table draft_paragraphs enable row level security;

drop policy if exists draft_ledgers_own on draft_ledgers;
create policy draft_ledgers_own on draft_ledgers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists draft_paragraphs_own on draft_paragraphs;
create policy draft_paragraphs_own on draft_paragraphs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
