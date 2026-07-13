# Architecture

## Stack

- **Frontend:** Next.js 16 App Router, React 19, Tailwind CSS v4
- **Backend:** Next.js API routes (Node.js runtime)
- **Database:** Supabase (PostgreSQL)
- **Storage:** Supabase Storage (product images)
- **Integrations:** Shopify Admin GraphQL, Resend (email)

## Platform Core (`lib/thomas/`)

Thomas OS platform primitives live outside tenant-specific code:

```
lib/thomas/
  tenant/resolve.ts    # Active tenant config (single tenant today)
  tenant/scope.ts      # getOrganizationId() for query scoping
  auth/require-staff.ts # Session validation for API handlers
  api/staff-route.ts   # Wrapper: auth + admin client + errors
```

Tenant branding and commerce settings: `tenants/chosen-by-chloe/config.ts`.

**Auth model:** Middleware gates `/admin/*` and `/api/*` (except `POST /api/orders`). Protected handlers use `staffRoute()` for defence-in-depth `requireStaff()` checks.

## Inventory Architecture

```
Customer Order / Goods Receipt / Stock Take
              ↓
      createStockMovement()  ← immutable ledger
              ↓
    inventory_balances       ← updated transactionally
              ↓
    products.stock           ← synced for storefront
```

**Rule:** Never edit `inventory_balances` or `products.stock` directly. All changes go through `lib/inventory/movements.ts`.

## Service Layer (not repositories)

Business logic lives in `lib/*` modules that accept `SupabaseClient` as their first argument. This is the project's data access and domain layer — a separate repository abstraction is intentionally not used.

| Module | Path |
|--------|------|
| Orders | `lib/orders.ts` |
| Inventory | `lib/inventory/*` |
| Warehouse | `lib/warehouse/*` |
| Purchasing | `lib/purchasing/*` |
| Platform | `lib/thomas/*` |

## Multi-tenancy (foundation)

Migration `0009_platform_foundation.sql` adds:

- `organizations` — tenant registry
- `staff_profiles` — links auth users to organisations (not yet enforced in app code)
- `organization_id` on `products`, `orders`, `warehouses`, `suppliers`, `brands`, `purchase_orders`

Sprint 009 enforces org scoping on list/dashboard queries via `getOrganizationId()`.

## Key Tables

| Table | Purpose |
|-------|---------|
| `organizations` | Tenant registry |
| `staff_profiles` | Staff ↔ org mapping |
| `products` | Product Master (canonical SKU record) |
| `warehouses` | Warehouse definitions |
| `warehouse_locations` | Bins/shelves within warehouses |
| `inventory_balances` | Current stock per product × location |
| `stock_movements` | Immutable audit ledger |
| `goods_receipts` | Inbound receiving |
| `stock_take_sessions` | Cycle count sessions |
| `inventory_alerts` | Low stock, negative stock, etc. |
| `pick_lists` / `pack_sessions` | Warehouse operations |
| `suppliers` / `purchase_orders` | Purchasing |

## Folder Structure

```
web/
  app/admin/               # Admin UI (client components → APIs)
  app/api/                 # JSON + PDF APIs
  app/shop, app/checkout   # Storefront
  lib/thomas/              # Platform core
  lib/inventory/           # Inventory business logic
  lib/warehouse/           # Warehouse services
  lib/purchasing/          # Procurement services
  tenants/chosen-by-chloe/ # First tenant config
  components/thomas/       # Shared platform UI (ModuleNav)
  supabase/migrations/     # Schema migrations (0001–0009)
```

## Domain Events

Not implemented. Audit trails use `stock_movements` and `warehouse_events`. A formal event bus is deferred until Treasury or CRM require cross-module reactions. See `docs/reviews/ARCHITECTURE_REVIEW_V1.md`.

## Further Reading

- [Architecture Review V1](../reviews/ARCHITECTURE_REVIEW_V1.md)
- [Technical Debt](../reviews/TECHNICAL_DEBT.md)
- [ADR-002 Inventory](../adr/ADR-002-Inventory.md)
