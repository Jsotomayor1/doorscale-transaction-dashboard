alter table public.transactions
  add column if not exists assigned_to text,
  add column if not exists contact_name text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text;
