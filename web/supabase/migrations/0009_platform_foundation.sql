-- Sprint 008.5: Platform foundation — organizations, staff profiles, tenant scoping

-- ─── Organizations ───────────────────────────────────────────────────────────

create table if not exists public.organizations (
  id uuid primary key,
  slug text not null unique,
  name text not null,
  settings jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.organizations (id, slug, name)
values (
  '00000000-0000-0000-0000-000000000001',
  'chosen-by-chloe',
  'Chosen by Chloe'
)
on conflict (id) do nothing;

-- ─── Staff profiles (links Supabase Auth users to an organization) ───────────

create table if not exists public.staff_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role text not null default 'admin',
  display_name text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, organization_id)
);

create index if not exists staff_profiles_org_idx
  on public.staff_profiles (organization_id);

create index if not exists staff_profiles_user_idx
  on public.staff_profiles (user_id);

-- ─── organization_id on core business tables ─────────────────────────────────

alter table public.products
  add column if not exists organization_id uuid
    references public.organizations(id)
    default '00000000-0000-0000-0000-000000000001';

alter table public.orders
  add column if not exists organization_id uuid
    references public.organizations(id)
    default '00000000-0000-0000-0000-000000000001';

alter table public.warehouses
  add column if not exists organization_id uuid
    references public.organizations(id)
    default '00000000-0000-0000-0000-000000000001';

alter table public.suppliers
  add column if not exists organization_id uuid
    references public.organizations(id)
    default '00000000-0000-0000-0000-000000000001';

alter table public.brands
  add column if not exists organization_id uuid
    references public.organizations(id)
    default '00000000-0000-0000-0000-000000000001';

alter table public.purchase_orders
  add column if not exists organization_id uuid
    references public.organizations(id)
    default '00000000-0000-0000-0000-000000000001';

create index if not exists products_organization_idx on public.products (organization_id);
create index if not exists orders_organization_idx on public.orders (organization_id);
create index if not exists warehouses_organization_idx on public.warehouses (organization_id);
create index if not exists suppliers_organization_idx on public.suppliers (organization_id);
create index if not exists purchase_orders_organization_idx on public.purchase_orders (organization_id);

-- Backfill existing rows
update public.products set organization_id = '00000000-0000-0000-0000-000000000001' where organization_id is null;
update public.orders set organization_id = '00000000-0000-0000-0000-000000000001' where organization_id is null;
update public.warehouses set organization_id = '00000000-0000-0000-0000-000000000001' where organization_id is null;
update public.suppliers set organization_id = '00000000-0000-0000-0000-000000000001' where organization_id is null;
update public.brands set organization_id = '00000000-0000-0000-0000-000000000001' where organization_id is null;
update public.purchase_orders set organization_id = '00000000-0000-0000-0000-000000000001' where organization_id is null;
