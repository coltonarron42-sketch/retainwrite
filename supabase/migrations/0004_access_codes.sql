-- Access codes placeholder. Full schema is defined in retainwrite-admin-passcodes-spec.md.
-- Kept so Stage 1 migration remains numbered 0005.

alter type purchase_kind add value if not exists 'access_code';

alter table profiles
  add column if not exists unlimited_access boolean not null default false,
  add column if not exists unlimited_until timestamptz,
  add column if not exists audio_included boolean not null default false,
  add column if not exists passcode_credits int not null default 0;
