-- In-progress drafts and a resume pointer. Additive.
-- Do not apply from the app. Run on project "Retain write" only.
-- private stays unexposed. This table is public with row-level security.
-- anon gets no privileges.

create table if not exists public.paper_autosaves (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.papers on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  field_key text not null,
  draft_text text not null default '',
  submitted boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (paper_id, field_key)
);

create index if not exists paper_autosaves_paper_idx on public.paper_autosaves (paper_id, updated_at desc);

alter table public.paper_autosaves enable row level security;

drop policy if exists paper_autosaves_own on public.paper_autosaves;
create policy paper_autosaves_own on public.paper_autosaves
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on table public.paper_autosaves from anon;
grant select, insert, update, delete on table public.paper_autosaves to authenticated, service_role;

alter table public.papers add column if not exists resume jsonb not null default '{}'::jsonb;

revoke all on table public.paper_autosaves from public;
grant select, insert, update, delete on table public.paper_autosaves to authenticated, service_role;
