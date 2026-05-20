create extension if not exists pgcrypto;

create table if not exists public.task_templates (
  id uuid primary key default gen_random_uuid(),
  location_id text default 'demo-location',
  transaction_type text,
  stage text,
  title text,
  days_offset integer default 0,
  assigned_role text,
  sort_order integer,
  created_at timestamp default now()
);

create index if not exists task_templates_lookup_idx
  on public.task_templates (location_id, transaction_type, stage, sort_order);
