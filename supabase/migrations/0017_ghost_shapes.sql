-- PC-28 ghost paper #1 (shape) and #2 (basic outline), sibling of private.hidden_drafts.
-- Same rules: `private` must NOT be added to Supabase exposed API schemas; the table is
-- read and written only through these service-role functions. Students only ever get
-- titles and subheadings from the app, never the private plan.
-- Apply on production project "Retain write" (hstxsytpcpusmjlcrhfz) only. Idempotent.

create schema if not exists private;
revoke all on schema private from anon, authenticated;

create table if not exists private.ghost_shapes (
  paper_id uuid primary key references public.papers on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  shape jsonb,
  shape_hash text,
  shape_at timestamptz,
  outline jsonb,
  outline_hash text,
  outline_at timestamptz,
  generations int not null default 0,
  purge_after timestamptz not null default (now() + interval '90 days'),
  created_at timestamptz not null default now()
);

alter table private.ghost_shapes enable row level security;
revoke all on private.ghost_shapes from anon, authenticated;

create or replace function public.upsert_ghost_shape(
  p_paper_id uuid,
  p_user_id uuid,
  p_kind text,
  p_data jsonb,
  p_hash text
) returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  existing private.ghost_shapes%rowtype;
begin
  if p_kind not in ('shape', 'outline') then
    raise exception 'invalid_kind';
  end if;
  if not exists (select 1 from public.papers where id = p_paper_id and user_id = p_user_id) then
    raise exception 'paper_not_found';
  end if;
  select * into existing from private.ghost_shapes where paper_id = p_paper_id for update;
  if found and existing.generations >= 40 then
    return jsonb_build_object('status', 'capped');
  end if;
  if not found then
    insert into private.ghost_shapes (paper_id, user_id) values (p_paper_id, p_user_id);
  end if;
  if p_kind = 'shape' then
    update private.ghost_shapes
      set shape = p_data, shape_hash = p_hash, shape_at = now(), generations = generations + 1,
          purge_after = now() + interval '90 days'
      where paper_id = p_paper_id;
  else
    update private.ghost_shapes
      set outline = p_data, outline_hash = p_hash, outline_at = now(), generations = generations + 1,
          purge_after = now() + interval '90 days'
      where paper_id = p_paper_id;
  end if;
  return jsonb_build_object('status', 'stored');
end;
$$;

create or replace function public.get_ghost_shape(p_paper_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  g private.ghost_shapes%rowtype;
begin
  select * into g from private.ghost_shapes where paper_id = p_paper_id;
  if not found then
    return jsonb_build_object('found', false);
  end if;
  return jsonb_build_object(
    'found', true,
    'shape', g.shape,
    'shape_hash', g.shape_hash,
    'outline', g.outline,
    'outline_hash', g.outline_hash,
    'generations', g.generations
  );
end;
$$;

create or replace function public.purge_ghost_shapes()
returns integer
language plpgsql
security definer
set search_path = public, private
as $$
declare
  n integer;
begin
  delete from private.ghost_shapes where purge_after <= now();
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.upsert_ghost_shape(uuid, uuid, text, jsonb, text) from public;
revoke all on function public.upsert_ghost_shape(uuid, uuid, text, jsonb, text) from anon;
revoke all on function public.upsert_ghost_shape(uuid, uuid, text, jsonb, text) from authenticated;
grant execute on function public.upsert_ghost_shape(uuid, uuid, text, jsonb, text) to service_role;

revoke all on function public.get_ghost_shape(uuid) from public;
revoke all on function public.get_ghost_shape(uuid) from anon;
revoke all on function public.get_ghost_shape(uuid) from authenticated;
grant execute on function public.get_ghost_shape(uuid) to service_role;

revoke all on function public.purge_ghost_shapes() from public;
revoke all on function public.purge_ghost_shapes() from anon;
revoke all on function public.purge_ghost_shapes() from authenticated;
grant execute on function public.purge_ghost_shapes() to service_role;
