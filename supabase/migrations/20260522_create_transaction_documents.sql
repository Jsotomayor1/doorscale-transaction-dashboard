create extension if not exists pgcrypto;

create table if not exists public.transaction_documents (
  id uuid primary key default gen_random_uuid(),
  location_id text not null,
  transaction_id uuid references public.transactions(id) on delete cascade,
  document_type text not null,
  document_name text,
  doorscale_file_id text,
  doorscale_contact_id text,
  status text default 'Needed',
  uploaded_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

create index if not exists transaction_documents_transaction_id_idx
  on public.transaction_documents (transaction_id);

create index if not exists transaction_documents_location_id_idx
  on public.transaction_documents (location_id);

create unique index if not exists transaction_documents_unique_type_idx
  on public.transaction_documents (transaction_id, document_type);
