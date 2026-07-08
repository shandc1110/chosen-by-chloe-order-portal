-- Version 2 ordering: capture full checkout details on the order.
-- The API route degrades gracefully if these are missing, but running this
-- migration lets email, delivery address, payment method, and preferred
-- currency be persisted properly.

alter table public.orders
  add column if not exists email text,
  add column if not exists address text,
  add column if not exists payment_method text,
  add column if not exists currency text;
