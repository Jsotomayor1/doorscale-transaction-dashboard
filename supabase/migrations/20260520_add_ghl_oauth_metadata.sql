alter table public.ghl_locations
  add column if not exists company_id text,
  add column if not exists user_id text,
  add column if not exists user_type text,
  add column if not exists scope text,
  add column if not exists refresh_token_id text,
  add column if not exists is_bulk_installation boolean default false;
