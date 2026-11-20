-- Minimal AI checker foundation so Stage 1 can reuse voice_profiles.
-- Full checker tables/routes land in the AI checker phase.

create table if not exists voice_profiles (
  user_id uuid primary key references auth.users on delete cascade,
  sample_text text not null default '',
  metrics jsonb not null default '{}',
  source text, -- ai_checker | stage1 | merged
  word_count int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table voice_profiles enable row level security;

create policy "voice_profiles_own"
  on voice_profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
