begin;

create table public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references auth.users(id),
  dismissed_tips text[] not null default '{}'::text[],
  staff_reporting_intro_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_preferences_tenant_key unique (organization_id, id),
  constraint user_preferences_user_tenant_key unique (organization_id, user_id),
  constraint user_preferences_membership_fk
    foreign key (organization_id, user_id)
    references public.memberships (organization_id, user_id)
);

create trigger user_preferences_set_updated_at
before update on public.user_preferences
for each row execute function private.set_updated_at();

commit;

