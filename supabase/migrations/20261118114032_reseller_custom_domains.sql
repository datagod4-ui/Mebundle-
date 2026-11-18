create table if not exists public.reseller_custom_domains (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid not null references public.reseller_profiles(id) on delete cascade,
  domain text not null,
  status text not null default 'pending_verification'
    check (status in ('pending_verification','verified','active','suspended','rejected')),
  verification_token text not null,
  verified_at timestamptz,
  connected_at timestamptz,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reseller_custom_domains_domain_unique unique (domain),
  constraint reseller_custom_domains_domain_format check (
    domain = lower(domain)
    and length(domain) between 4 and 253
    and domain ~ '^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$'
    and domain !~ '\.\.'
  )
);
create index if not exists reseller_custom_domains_reseller_idx
  on public.reseller_custom_domains(reseller_id, created_at desc);
create index if not exists reseller_custom_domains_status_idx
  on public.reseller_custom_domains(status);
alter table public.reseller_custom_domains enable row level security;
revoke all on public.reseller_custom_domains from anon, authenticated;
