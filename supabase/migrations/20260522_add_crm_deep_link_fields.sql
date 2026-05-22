alter table public.transactions
  add column if not exists ghl_contact_id text,
  add column if not exists ghl_location_id text;

create index if not exists transactions_ghl_contact_id_idx
  on public.transactions (ghl_contact_id);

create index if not exists transactions_ghl_location_id_idx
  on public.transactions (ghl_location_id);
