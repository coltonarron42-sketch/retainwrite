-- Section loop, lesson routing, and hybrid voice counts.
-- Additive after 0007. RLS: auth.uid() = user_id.

create table if not exists section_plans (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references papers on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  section_key text not null,
  sort_order int not null,
  title text not null,
  kind text not null,
  needs text not null,
  rubric_refs jsonb not null default '[]',
  required_sources jsonb not null default '{}',
  required_styles jsonb not null default '[]',
  target_words int,
  story_link text,
  provenance jsonb not null default '[]',
  source text not null default 'rubric',
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  mode text not null default 'lesson' check (mode in ('lesson', 'memory')),
  concept text,
  unique (paper_id, section_key)
);

create table if not exists section_decisions (
  id uuid primary key default gen_random_uuid(),
  section_plan_id uuid not null unique references section_plans on delete cascade,
  paper_id uuid not null references papers on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  loop_step text not null default 'teach'
    check (loop_step in ('teach', 'probe', 'search', 'summarize', 'confirm', 'logic_check', 'confirmed')),
  probe_choice text,
  ideas jsonb not null default '[]',
  search_terms jsonb not null default '[]',
  chosen_lead_ids uuid[] not null default '{}',
  chosen_style text,
  source_card_ids jsonb not null default '[]',
  status text not null default 'open',
  skipped_at timestamptz,
  logic_tier text,
  logic_basis text,
  logic_confidence numeric(3,2),
  logic_reason text,
  logic_cited_term jsonb,
  logic_claim_ref jsonb,
  logic_alternatives jsonb not null default '[]',
  logic_reframe_available boolean,
  logic_student_choice text,
  logic_attempts int not null default 0,
  logic_downgraded_from text,
  logic_failed_open boolean not null default false,
  logic_prompt_version text,
  logic_checked_at timestamptz,
  logic_resolved_at timestamptz,
  logic_history jsonb not null default '[]',
  confirm_snapshot jsonb,
  confirmed_at timestamptz,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  teach_status text,
  teach_card jsonb,
  teach_aspect text,
  highlight_reels jsonb not null default '[]',
  memory_triggers jsonb not null default '[]',
  memory_card jsonb,
  search_status text not null default 'required'
    check (search_status in ('required', 'optional', 'not_needed'))
);

alter table research_leads add column if not exists section_plan_id uuid references section_plans on delete set null;
alter table research_leads add column if not exists rubric_ref text;
alter table research_leads add column if not exists origin text not null default 'ai_suggested';
alter table research_leads add column if not exists batch_no int;
alter table research_leads add column if not exists is_wildcard boolean not null default false;
alter table research_leads add column if not exists wildcard_why text;
alter table research_leads add column if not exists controversy_note text;
alter table research_leads add column if not exists rubric_match numeric(3,2);
alter table research_leads add column if not exists rank int;
alter table research_leads add column if not exists lesson_link text;

alter table drafts add column if not exists section_paste_meta jsonb not null default '{}';
alter table sources add column if not exists section_plan_id uuid references section_plans on delete set null;

alter table papers add column if not exists lesson jsonb;
alter table papers add column if not exists lesson_source text;
alter table papers add column if not exists prompt_type text not null default 'lesson';
alter table papers drop constraint if exists papers_prompt_type_check;
alter table papers add constraint papers_prompt_type_check
  check (prompt_type in ('lesson', 'personal_experience', 'mixed'));
alter table papers add column if not exists prompt_type_confidence numeric(3,2);
alter table papers add column if not exists prompt_type_source text;
alter table papers add column if not exists natural_voice_words int not null default 0;
alter table papers add column if not exists voice_pasted_share numeric(4,3);

alter table voice_profiles add column if not exists natural_words int;
alter table voice_profiles add column if not exists typed_word_share numeric(4,3);

alter table intake_answers add column if not exists pasted_chars int not null default 0;
alter table intake_answers add column if not exists typed_chars int not null default 0;
alter table intake_answers add column if not exists paste_events int not null default 0;
alter table intake_answers add column if not exists paste_ratio numeric(4,3);

create index if not exists section_plans_paper_order_idx on section_plans (paper_id, sort_order);
create index if not exists section_decisions_paper_idx on section_decisions (paper_id);
create index if not exists research_leads_paper_origin_idx on research_leads (paper_id, origin);
create index if not exists research_leads_paper_wildcard_idx on research_leads (paper_id, is_wildcard);

alter table section_plans enable row level security;
alter table section_decisions enable row level security;

drop policy if exists section_plans_own on section_plans;
create policy section_plans_own on section_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists section_decisions_own on section_decisions;
create policy section_decisions_own on section_decisions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
