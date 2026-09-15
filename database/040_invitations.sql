begin;

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  intended_email text not null
    check (intended_email = lower(btrim(intended_email)))
    check (char_length(intended_email) between 3 and 320),
  role text not null default 'staff' check (role in ('owner', 'staff')),
  token_hash bytea not null,
  invited_by uuid not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint invitations_tenant_key unique (organization_id, id),
  constraint invitations_token_hash_key unique (token_hash),
  constraint invitations_inviter_membership_fk
    foreign key (organization_id, invited_by)
    references public.memberships (organization_id, user_id),
  constraint invitations_acceptance_consistency check (
    (accepted_at is null and accepted_by is null)
    or (accepted_at is not null and accepted_by is not null)
  ),
  constraint invitations_terminal_state check (
    not (accepted_at is not null and revoked_at is not null)
  )
);

create index invitations_organization_email_idx
  on public.invitations (organization_id, intended_email, created_at desc);

create index invitations_expiry_idx
  on public.invitations (expires_at)
  where accepted_at is null and revoked_at is null;

commit;

