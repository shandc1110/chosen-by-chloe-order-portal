# Sprint 008.5 — Platform Foundation

## Objective

Prepare **Thomas OS** as a multi-tenant retail platform with Chosen by Chloe as the first tenant.

## Delivered

### API security
- Middleware protects all `/api/*` routes except `POST /api/orders` (public checkout)
- Unauthenticated API requests return `401 JSON`
- `lib/thomas/auth/require-staff.ts` for defence-in-depth in route handlers

### Thomas core (`lib/thomas/`)
- Platform config (`THOMAS` constants)
- Tenant resolution (`getActiveTenant`, `getClientTenant`)
- Public route registry

### Tenant layer (`tenants/chosen-by-chloe/`)
- Brand, commerce, email, integrations, storefront config
- CBC-specific values removed from platform `lib/` modules

### Database migration `0009_platform_foundation.sql`
- `organizations` table (seed: Chosen by Chloe)
- `staff_profiles` (auth users → organization + role)
- `organization_id` on products, orders, warehouses, suppliers, brands, purchase_orders

### Stock ledger cleanup
- Removed `products.stock` CAS dual-write from order creation
- Orders require warehouse configuration; stock changes via `createStockMovement()` only

### Rename preparation
- `package.json` name → `thomas-os`
- Admin UI branded as **Thomas** with tenant name shown as context
- Storefront uses tenant config for branding

## Migration

Run in Supabase SQL Editor:

```
web/supabase/migrations/0009_platform_foundation.sql
```

## Staff setup

1. Create admin user in Supabase Auth
2. Optionally link to organization:

```sql
insert into staff_profiles (user_id, organization_id, role, display_name)
values (
  '<auth-user-uuid>',
  '00000000-0000-0000-0000-000000000001',
  'admin',
  'Your Name'
);
```

## Test checklist

- [ ] Unauthenticated `GET /api/inventory/dashboard` returns 401
- [ ] `POST /api/orders` works without auth (checkout)
- [ ] Admin login → console → modules work with session cookie
- [ ] Storefront shows Chosen by Chloe branding from tenant config
- [ ] Order create uses ledger only (no CAS on products.stock)
- [ ] Migration 0009 applied successfully

## Next

Sprint 009 — Treasury
