-- Document upload metadata for DoorScale transaction checklists.
insert into storage.buckets (id, name, public)
values ('transaction-documents', 'transaction-documents', false)
on conflict (id) do nothing;

alter table public.transaction_documents
  add column if not exists file_name text,
  add column if not exists file_path text,
  add column if not exists file_url text,
  add column if not exists uploaded_by text,
  add column if not exists ghl_contact_id text,
  add column if not exists ghl_opportunity_id text;

alter table public.transaction_documents
  add column if not exists uploaded_at timestamp with time zone,
  add column if not exists status text;
