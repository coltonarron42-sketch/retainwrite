-- Hidden-draft access for the service role only.
-- `private` stays out of Supabase exposed API schemas. PostgREST cannot read the table.
-- Do not apply from the app. Run on project "Retain write" (hstxsytpcpusmjlcrhfz) only.
-- Idempotent. Paper and account deletion already cascade from 0011.

create or replace function public.upsert_hidden_draft(
  p_paper_id uuid,
  p_user_id uuid,
  p_mode text,
  p_ledger_hash text,
  p_text jsonb,
  p_signals jsonb,
  p_canary text,
  p_trigger text,
  p_drafting_complete boolean
) returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  existing private.hidden_drafts%rowtype;
  next_generations int;
  next_version int;
  born timestamptz;
  draft_done timestamptz;
  purge_at timestamptz;
begin
  if p_mode not in ('prose', 'structure') then
    raise exception 'invalid_mode';
  end if;
  if p_trigger not in ('section_complete', 'outline_approved', 'draft_section_done') then
    raise exception 'invalid_trigger';
  end if;
  if not exists (
    select 1 from public.papers where id = p_paper_id and user_id = p_user_id
  ) then
    raise exception 'paper_not_found';
  end if;

  select * into existing from private.hidden_drafts where paper_id = p_paper_id;

  if existing.paper_id is not null then
    if existing.ledger_hash = p_ledger_hash then
      return jsonb_build_object(
        'status', 'unchanged',
        'generations', existing.generations,
        'version', existing.version
      );
    end if;
    if existing.generations >= 15 then
      return jsonb_build_object(
        'status', 'capped',
        'generations', existing.generations,
        'version', existing.version
      );
    end if;
    next_generations := existing.generations + 1;
    next_version := existing.version + 1;
    born := existing.created_at;
  else
    next_generations := 1;
    next_version := 1;
    born := now();
  end if;

  select sp.completed_at into draft_done
  from public.stage_progress sp
  where sp.paper_id = p_paper_id
    and sp.stage = 5
    and sp.status = 'complete'
    and sp.completed_at is not null
  limit 1;

  purge_at := born + interval '90 days';
  if draft_done is not null or p_drafting_complete then
    purge_at := least(purge_at, coalesce(draft_done, now()) + interval '30 days');
  end if;

  insert into private.hidden_drafts (
    paper_id, user_id, version, mode, ledger_hash, text, signals, canary,
    generated_at, trigger, generations, purge_after, created_at
  ) values (
    p_paper_id,
    p_user_id,
    next_version,
    p_mode,
    p_ledger_hash,
    case when p_mode = 'structure' then null else p_text end,
    p_signals,
    p_canary,
    now(),
    p_trigger,
    next_generations,
    purge_at,
    born
  )
  on conflict (paper_id) do update set
    version = excluded.version,
    mode = excluded.mode,
    ledger_hash = excluded.ledger_hash,
    text = excluded.text,
    signals = excluded.signals,
    canary = excluded.canary,
    generated_at = excluded.generated_at,
    trigger = excluded.trigger,
    generations = excluded.generations,
    purge_after = excluded.purge_after;

  return jsonb_build_object(
    'status', 'stored',
    'generations', next_generations,
    'version', next_version
  );
end;
$$;

-- Signals only. The prose and the canary stay in the table.
create or replace function public.get_hidden_draft_signals(p_paper_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  row private.hidden_drafts%rowtype;
begin
  select * into row from private.hidden_drafts where paper_id = p_paper_id;
  if row.paper_id is null then
    return jsonb_build_object('found', false);
  end if;
  return jsonb_build_object(
    'found', true,
    'version', row.version,
    'mode', row.mode,
    'ledger_hash', row.ledger_hash,
    'signals', row.signals,
    'generations', row.generations,
    'trigger', row.trigger
  );
end;
$$;

-- Service-role leak check only. Callers must not put this payload in a response.
create or replace function public.load_hidden_draft_guard(p_paper_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  row private.hidden_drafts%rowtype;
begin
  select * into row from private.hidden_drafts where paper_id = p_paper_id;
  if row.paper_id is null or row.text is null then
    return jsonb_build_object('found', false);
  end if;
  return jsonb_build_object('found', true, 'text', row.text, 'canary', row.canary);
end;
$$;

create or replace function public.purge_hidden_drafts()
returns integer
language plpgsql
security definer
set search_path = public, private
as $$
declare
  removed integer;
begin
  update private.hidden_drafts as draft
  set purge_after = least(draft.created_at + interval '90 days', progress.completed_at + interval '30 days')
  from public.stage_progress as progress
  where progress.paper_id = draft.paper_id
    and progress.stage = 5
    and progress.status = 'complete'
    and progress.completed_at is not null;

  delete from private.hidden_drafts
  where purge_after <= now()
     or created_at <= now() - interval '90 days';

  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.upsert_hidden_draft(uuid, uuid, text, text, jsonb, jsonb, text, text, boolean) from public;
revoke all on function public.upsert_hidden_draft(uuid, uuid, text, text, jsonb, jsonb, text, text, boolean) from anon;
revoke all on function public.upsert_hidden_draft(uuid, uuid, text, text, jsonb, jsonb, text, text, boolean) from authenticated;
grant execute on function public.upsert_hidden_draft(uuid, uuid, text, text, jsonb, jsonb, text, text, boolean) to service_role;

revoke all on function public.get_hidden_draft_signals(uuid) from public;
revoke all on function public.get_hidden_draft_signals(uuid) from anon;
revoke all on function public.get_hidden_draft_signals(uuid) from authenticated;
grant execute on function public.get_hidden_draft_signals(uuid) to service_role;

revoke all on function public.load_hidden_draft_guard(uuid) from public;
revoke all on function public.load_hidden_draft_guard(uuid) from anon;
revoke all on function public.load_hidden_draft_guard(uuid) from authenticated;
grant execute on function public.load_hidden_draft_guard(uuid) to service_role;

revoke all on function public.purge_hidden_drafts() from public;
revoke all on function public.purge_hidden_drafts() from anon;
revoke all on function public.purge_hidden_drafts() from authenticated;
grant execute on function public.purge_hidden_drafts() to service_role;

-- Table grants for the service role. private stays out of the exposed API schemas.
revoke all on schema private from anon, authenticated;
revoke all on table private.hidden_drafts from anon, authenticated;
grant usage on schema private to service_role;
grant select, insert, update, delete on private.hidden_drafts to service_role;
