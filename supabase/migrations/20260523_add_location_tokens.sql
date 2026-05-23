alter table public.ghl_locations
  add column if not exists selected_location_id text,
  add column if not exists location_access_token text,
  add column if not exists location_refresh_token text,
  add column if not exists location_token_expires_at timestamp with time zone;

create index if not exists ghl_locations_selected_location_id_idx
  on public.ghl_locations (selected_location_id);
