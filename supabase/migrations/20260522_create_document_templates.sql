create extension if not exists pgcrypto;

create table if not exists public.document_templates (
  id uuid primary key default gen_random_uuid(),
  location_id text default 'demo-location',
  transaction_type text,
  stage text,
  stage_name text,
  document_type text not null,
  delivery_type text default 'manual_upload',
  workflow_trigger_tag text,
  workflow_name text,
  sort_order integer,
  created_at timestamp with time zone default now()
);

create index if not exists document_templates_lookup_idx
  on public.document_templates (location_id, transaction_type, stage, sort_order);
