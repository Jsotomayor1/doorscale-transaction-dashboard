alter table public.transaction_documents
  add column if not exists template_id uuid references public.document_templates(id);

create index if not exists transaction_documents_template_id_idx
  on public.transaction_documents (template_id);

create unique index if not exists transaction_documents_unique_template_idx
  on public.transaction_documents (location_id, transaction_id, template_id)
  where template_id is not null;
