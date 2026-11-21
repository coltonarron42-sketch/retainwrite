-- Interaction layer + hidden-draft scaffold (S3-t57).
-- `private` must NOT be added to Supabase exposed API schemas.
-- Apply on production project "Retain write" (hstxsytpcpusmjlcrhfz) only.
-- Never apply to any other Supabase project.

create schema if not exists private;
revoke all on schema private from anon, authenticated;

create table if not exists private.hidden_drafts (
  paper_id uuid primary key references public.papers on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  version int not null default 1,
  mode text not null check (mode in ('prose','structure')),
  ledger_hash text not null,
  text jsonb,
  signals jsonb not null,
  canary text,
  generated_at timestamptz not null default now(),
  trigger text not null,
  generations int not null default 1,
  purge_after timestamptz not null,
  created_at timestamptz not null default now()
);

alter table private.hidden_drafts enable row level security;
revoke all on private.hidden_drafts from anon, authenticated;

alter table public.papers add column if not exists payoff_shown_at timestamptz;
