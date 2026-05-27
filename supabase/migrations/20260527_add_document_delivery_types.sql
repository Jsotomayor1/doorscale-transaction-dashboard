alter table public.document_templates
  add column if not exists stage_name text,
  add column if not exists delivery_type text default 'manual_upload',
  add column if not exists workflow_trigger_tag text,
  add column if not exists workflow_name text;

alter table public.transaction_documents
  add column if not exists delivery_type text default 'manual_upload',
  add column if not exists workflow_trigger_tag text,
  add column if not exists workflow_name text;
