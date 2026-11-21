-- Extract-first Stage 1 additives (build prompt Nov 20, 2026).
-- 0006 already created assignment-files upload columns; this adds follow-up + story.

alter table assignments
  add column if not exists followup_asked_at timestamptz,
  add column if not exists story_angle jsonb not null default '{}',
  add column if not exists story_options jsonb not null default '[]';

comment on column assignments.followup_asked_at is
  'Set when the student answers the single missing-important follow-up (once).';
comment on column assignments.story_angle is
  'Chosen story angle { text, source: ai|student } handed to Stage 2.';
comment on column assignments.story_options is
  'Cached 3–4 story angle questions offered at end of Stage 1 coaching.';
