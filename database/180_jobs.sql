begin;

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  job_type text not null check (char_length(job_type) between 1 and 120),
  payload_reference jsonb not null check (jsonb_typeof(payload_reference) = 'object'),
  state text not null default 'pending'
    check (state in ('pending', 'leased', 'retry', 'completed', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 8 check (max_attempts between 1 and 100),
  next_run_at timestamptz not null default now(),
  lease_token uuid,
  leased_until timestamptz,
  last_error text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jobs_lease_consistency check (
    (state = 'leased' and lease_token is not null and leased_until is not null)
    or (state <> 'leased' and lease_token is null and leased_until is null)
  ),
  constraint jobs_completion_consistency check (
    (state = 'completed' and completed_at is not null)
    or (state <> 'completed' and completed_at is null)
  )
);

create index jobs_state_next_run_idx
  on public.jobs (state, next_run_at, id)
  where state in ('pending', 'retry');

create index jobs_lease_expiry_idx
  on public.jobs (leased_until, id)
  where state = 'leased';

create index jobs_organization_idx
  on public.jobs (organization_id, created_at desc, id);

create trigger jobs_set_updated_at
before update on public.jobs
for each row execute function private.set_updated_at();

commit;

