alter table public.tasks
  add column if not exists due_datetime timestamp with time zone;

create index if not exists tasks_due_datetime_idx
  on public.tasks (location_id, due_datetime);
