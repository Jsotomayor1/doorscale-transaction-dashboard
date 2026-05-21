alter table public.ghl_locations
  add column if not exists location_name text;
