alter table public.ghl_locations
  add column if not exists selected_location_name text;
