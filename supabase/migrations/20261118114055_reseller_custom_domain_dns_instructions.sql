alter table public.reseller_custom_domains
  add column if not exists dns_instructions jsonb not null default '[]'::jsonb;
