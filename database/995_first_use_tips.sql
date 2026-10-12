begin;

-- First-use help: each signed-in member dismisses contextual tips for
-- themselves, can bring them all back, and staff see a short reporting
-- introduction once. Preferences are personal and never shared.

create or replace function private.ensure_user_preferences(
  p_organization_id uuid,
  p_user_id uuid
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.user_preferences (organization_id, user_id)
  values (p_organization_id, p_user_id)
  on conflict (organization_id, user_id) do nothing;
$$;

revoke all on function private.ensure_user_preferences(uuid, uuid) from public;

create or replace function public.dismiss_tip(
  p_organization_id uuid,
  p_tip_key text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null
    or not private.is_active_member(p_organization_id, v_actor_id) then
    raise exception using errcode = '42501', message = 'Membership required.';
  end if;

  if p_tip_key is null or p_tip_key !~ '^[a-z][a-z0-9_]{1,39}$' then
    raise exception using errcode = '22023', message = 'Invalid tip.';
  end if;

  perform private.ensure_user_preferences(p_organization_id, v_actor_id);

  update public.user_preferences as preference
  set dismissed_tips = array_append(preference.dismissed_tips, p_tip_key)
  where preference.organization_id = p_organization_id
    and preference.user_id = v_actor_id
    and not (p_tip_key = any (preference.dismissed_tips))
    and pg_catalog.cardinality(preference.dismissed_tips) < 50;
end;
$$;

create or replace function public.reset_tips(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null
    or not private.is_active_member(p_organization_id, v_actor_id) then
    raise exception using errcode = '42501', message = 'Membership required.';
  end if;

  perform private.ensure_user_preferences(p_organization_id, v_actor_id);

  update public.user_preferences as preference
  set dismissed_tips = '{}'::text[]
  where preference.organization_id = p_organization_id
    and preference.user_id = v_actor_id;
end;
$$;

create or replace function public.mark_staff_intro_seen(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null
    or not private.is_active_member(p_organization_id, v_actor_id) then
    raise exception using errcode = '42501', message = 'Membership required.';
  end if;

  perform private.ensure_user_preferences(p_organization_id, v_actor_id);

  update public.user_preferences as preference
  set staff_reporting_intro_seen_at = coalesce(
    preference.staff_reporting_intro_seen_at, now()
  )
  where preference.organization_id = p_organization_id
    and preference.user_id = v_actor_id;
end;
$$;

revoke all on function public.dismiss_tip(uuid, text) from public, anon;
revoke all on function public.reset_tips(uuid) from public, anon;
revoke all on function public.mark_staff_intro_seen(uuid) from public, anon;

grant execute on function public.dismiss_tip(uuid, text) to authenticated;
grant execute on function public.reset_tips(uuid) to authenticated;
grant execute on function public.mark_staff_intro_seen(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
