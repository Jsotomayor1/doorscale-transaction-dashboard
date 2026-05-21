alter table public.transactions
  add column if not exists contact_id text,
  add column if not exists ghl_opportunity_id text;

alter table public.tasks
  add column if not exists ghl_task_id text,
  add column if not exists contact_id text,
  add column if not exists ghl_opportunity_id text;

create unique index if not exists tasks_ghl_task_id_key
  on public.tasks (ghl_task_id)
  where ghl_task_id is not null;

create index if not exists tasks_contact_id_idx
  on public.tasks (contact_id);

create index if not exists tasks_ghl_opportunity_id_idx
  on public.tasks (ghl_opportunity_id);

create index if not exists transactions_contact_id_idx
  on public.transactions (contact_id);
