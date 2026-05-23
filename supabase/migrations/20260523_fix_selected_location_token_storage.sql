alter table public.ghl_locations
  add column if not exists parent_connection_id text;

alter table public.ghl_locations
  alter column access_token drop not null,
  alter column refresh_token drop not null;

create index if not exists ghl_locations_parent_connection_id_idx
  on public.ghl_locations (parent_connection_id);
