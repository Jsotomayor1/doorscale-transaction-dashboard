alter table public.ghl_locations
  add column if not exists connection_status text default 'connected',
  add column if not exists available_locations jsonb default '[]'::jsonb,
  add column if not exists selected_at timestamp with time zone;

create index if not exists ghl_locations_connection_status_idx
  on public.ghl_locations (connection_status);

create index if not exists ghl_locations_company_id_idx
  on public.ghl_locations (company_id);
