-- Security advisor: lock down function execute grants and trigger search_path.
-- Idempotent. Do not apply from the app; run on project "Retain write" only.
-- No app code calls grant_feedback_credit. When it is called, use the service-role client.

revoke execute on function public.grant_feedback_credit(uuid) from public;
revoke execute on function public.grant_feedback_credit(uuid) from anon;
revoke execute on function public.grant_feedback_credit(uuid) from authenticated;
grant execute on function public.grant_feedback_credit(uuid) to service_role;

revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;

revoke execute on function public.init_stage_progress() from public;
revoke execute on function public.init_stage_progress() from anon;
revoke execute on function public.init_stage_progress() from authenticated;

alter function public.set_papers_updated_at() set search_path = public;
alter function public.set_assignments_updated_at() set search_path = public;
