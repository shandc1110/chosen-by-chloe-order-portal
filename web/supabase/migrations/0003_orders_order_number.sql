-- Human-readable order reference shown to customers (e.g. CBC9001).

alter table public.orders
  add column if not exists order_number text;

create unique index if not exists orders_order_number_key
  on public.orders (order_number)
  where order_number is not null;
