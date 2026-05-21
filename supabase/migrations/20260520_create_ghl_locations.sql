create table if not exists public.ghl_locations (
  location_id text primary key,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists ghl_locations_expires_at_idx
  on public.ghl_locations (expires_at);
