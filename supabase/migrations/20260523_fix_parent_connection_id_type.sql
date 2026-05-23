alter table public.ghl_locations
  alter column parent_connection_id type bigint
  using nullif(parent_connection_id, '')::bigint;
