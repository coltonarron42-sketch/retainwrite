-- Stage specs additive migration
alter type purchase_kind add value if not exists 'feedback_credit';

create type guardian_status as enum ('not_required','pending','granted','expired');
create type feedback_status as enum ('processing','auto_approved','needs_review','approved','rejected','needs_better_upload');

alter table profiles
  add column if not exists birth_date date,
  add column if not exists is_admin boolean not null default false,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists guardian_email text,
  add column if not exists guardian_status guardian_status not null default 'not_required',
  add column if not exists guardian_token_hash text,
  add column if not exists guardian_requested_at timestamptz,
  add column if not exists guardian_consented_at timestamptz;

alter table professor_feedback
  add column if not exists status feedback_status not null default 'processing',
  add column if not exists file_paths jsonb not null default '[]',
  add column if not exists file_hashes jsonb not null default '[]',
  add column if not exists auto_check jsonb not null default '{}',
  add column if not exists attempts int not null default 1,
  add column if not exists reviewed_by uuid references auth.users,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text,
  add column if not exists raw_delete_after timestamptz,
  add column if not exists raw_deleted_at timestamptz;

create index if not exists professor_feedback_file_hashes_idx
  on professor_feedback using gin (file_hashes jsonb_path_ops);

create or replace function public.grant_feedback_credit(feedback_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  row_user uuid;
  row_paper uuid;
begin
  update professor_feedback
    set credit_granted = true,
        status = 'approved',
        reviewed_at = coalesce(reviewed_at, now())
  where id = feedback_id and credit_granted = false
  returning user_id, paper_id into row_user, row_paper;

  if row_user is not null then
    update profiles set paper_credits = paper_credits + 1 where user_id = row_user;
    insert into purchases (user_id, paper_id, kind, amount_cents, status)
    values (row_user, row_paper, 'feedback_credit', 0, 'paid');
  end if;
end;
$$;
