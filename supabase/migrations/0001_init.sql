-- RetainWrite initial schema
create extension if not exists "pgcrypto";

create type stage_status as enum ('locked','in_progress','complete');
create type formality_level as enum ('casual','neutral','formal');
create type purchase_kind as enum ('single','pack3','audio');
create type purchase_status as enum ('pending','paid','failed','refunded');

create table profiles (
  user_id uuid primary key references auth.users on delete cascade,
  email text not null,
  display_name text,
  school_level text,
  free_paper_used boolean not null default false,
  paper_credits int not null default 0,
  created_at timestamptz not null default now()
);

create table papers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text,
  course text,
  due_date date,
  assignment_prompt text,
  required_length text,
  citation_style text,
  is_free_paper boolean not null default false,
  funded_by purchase_kind,
  audio_unlocked boolean not null default false,
  current_stage int not null default 1 check (current_stage between 1 and 6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table stage_progress (
  paper_id uuid references papers on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  stage int not null check (stage between 1 and 6),
  status stage_status not null default 'locked',
  data jsonb not null default '{}',
  completed_at timestamptz,
  primary key (paper_id, stage)
);

create table style_profiles (
  paper_id uuid primary key references papers on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  raw_sample text not null,
  word_count int not null,
  avg_sentence_length numeric not null,
  reading_grade numeric not null,
  formality formality_level not null,
  formality_score numeric not null,
  top_content_words jsonb not null,
  vocabulary jsonb not null,
  created_at timestamptz not null default now()
);

create table drafts (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references papers on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  version int not null,
  body text not null,
  metrics jsonb not null,
  mismatch jsonb,
  created_at timestamptz not null default now()
);

create table sources (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references papers on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  title text,
  storage_path text,
  rights_confirmed boolean not null default false,
  beats jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  paper_id uuid references papers,
  kind purchase_kind not null,
  amount_cents int not null,
  stripe_session_id text unique,
  stripe_payment_intent text,
  status purchase_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table session_events (
  id bigserial primary key,
  user_id uuid references auth.users on delete set null,
  paper_id uuid references papers on delete cascade,
  stage int,
  event text not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table professor_feedback (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null unique references papers on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  grade text,
  storage_path text not null,
  consent_given boolean not null,
  coded jsonb not null default '{}',
  credit_granted boolean not null default false,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table papers enable row level security;
alter table stage_progress enable row level security;
alter table style_profiles enable row level security;
alter table drafts enable row level security;
alter table sources enable row level security;
alter table purchases enable row level security;
alter table session_events enable row level security;
alter table professor_feedback enable row level security;

create policy profiles_own on profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy papers_own on papers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy stage_progress_own on stage_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy style_profiles_own on style_profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy drafts_own on drafts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy sources_own on sources for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy purchases_own on purchases for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy session_events_own on session_events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy professor_feedback_own on professor_feedback for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.set_papers_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger papers_updated_at
  before update on papers
  for each row execute procedure public.set_papers_updated_at();

create or replace function public.init_stage_progress()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into stage_progress (paper_id, user_id, stage, status)
  select new.id, new.user_id, g, case when g = 1 then 'in_progress'::stage_status else 'locked'::stage_status end
  from generate_series(1, 6) as g;
  return new;
end;
$$;

create trigger papers_init_stages
  after insert on papers
  for each row execute procedure public.init_stage_progress();

insert into storage.buckets (id, name, public) values
  ('sources', 'sources', false),
  ('feedback', 'feedback', false),
  ('audio', 'audio', false)
on conflict (id) do nothing;
