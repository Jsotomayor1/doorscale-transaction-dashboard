alter table public.transactions
  add column if not exists sync_status text default 'synced',
  add column if not exists last_sync_error text,
  add column if not exists last_synced_at timestamp with time zone;

alter table public.tasks
  add column if not exists sync_status text default 'synced',
  add column if not exists last_sync_error text,
  add column if not exists last_synced_at timestamp with time zone;

create index if not exists transactions_sync_status_idx
  on public.transactions (sync_status);

create index if not exists tasks_sync_status_idx
  on public.tasks (sync_status);
