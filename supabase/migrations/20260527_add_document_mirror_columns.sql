alter table public.transaction_documents
  add column if not exists ghl_mirror_status text,
  add column if not exists ghl_mirror_error text,
  add column if not exists ghl_file_url text;
