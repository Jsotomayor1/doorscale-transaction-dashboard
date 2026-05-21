alter table public.transactions
  add column if not exists ghl_opportunity_id text;

create unique index if not exists transactions_ghl_opportunity_id_key
  on public.transactions (ghl_opportunity_id)
  where ghl_opportunity_id is not null;
