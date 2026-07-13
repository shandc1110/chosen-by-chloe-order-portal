# Refactor Summary — Sprint 009

**Sprint:** Architecture Hardening  
**Date:** July 2026  
**Principle:** Incremental improvements; no rewrites; no new business features

---

## What Changed

### Platform core

| File | Change |
|------|--------|
| `lib/thomas/api/staff-route.ts` | **New** — wraps protected API handlers with `requireStaff()`, admin client, and error handling |
| `lib/thomas/tenant/scope.ts` | **New** — `getOrganizationId()` for tenant data scoping |

### Organisation scoping (service layer)

Added optional `organizationId` parameter to list/dashboard functions:

- `lib/orders.ts` — `listOrders`, `getOrderById`
- `lib/inventory/products.ts` — `listProducts`, `getDashboardStats`, `generateAlerts`, `upsertProduct`
- `lib/purchasing/suppliers.ts` — `listSuppliers`, `listBrands`, `listPurchaseOrders`, `getProcurementDashboard`
- `lib/warehouse/dashboard.ts` — `getWarehouseDashboard`, `listWarehouseOrders`
- `lib/warehouse/warehouses.ts` — `listWarehouses`, `createWarehouse`

API routes pass `getOrganizationId()` into these functions. Create/upsert handlers attach `organization_id` on new records.

### API routes (19 protected handlers)

All admin APIs now use `staffRoute()` except public `POST /api/orders`.

### Shared UI / client utilities

| File | Change |
|------|--------|
| `components/thomas/ModuleNav.tsx` | **New** — unified module navigation |
| `components/inventory/AdminNav.tsx` | Thin wrapper over `ModuleNav` |
| `components/purchasing/PurchasingNav.tsx` | Thin wrapper over `ModuleNav` |
| `components/warehouse/WarehouseUI.tsx` | `OpsNav` uses `ModuleNav` |
| `lib/client/download-packing-slip.ts` | **New** — shared PDF download |
| `hooks/useShopify.ts` | Uses shared download helper |
| `app/admin/orders/page.tsx` | Uses shared download helper |
| `app/admin/warehouse/packing/[orderId]/page.tsx` | Uses shared download helper |

### Configuration & dead code

| File | Change |
|------|--------|
| `lib/order-email.ts` | `server-only`; imports `formatOrderPrice` from `lib/format.ts` |
| `lib/currency.ts` | Added `getDisplayCnyToGbpRate()` |
| `app/checkout/page.tsx` | Uses tenant exchange rate for display |
| `lib/products.ts` | **Deleted** — legacy anon-client duplicate |
| `hooks/useInventory.ts` | **Deleted** — unused |
| `hooks/useWarehouse.ts` | **Deleted** — unused |

### Documentation

| File | Change |
|------|--------|
| `docs/reviews/ARCHITECTURE_REVIEW_V1.md` | **New** — full architecture audit |
| `docs/reviews/TECHNICAL_DEBT.md` | **New** — debt register |
| `docs/reviews/REFACTOR_SUMMARY.md` | **New** — this document |
| `docs/vision/ARCHITECTURE.md` | Updated platform core section |
| `docs/vision/ROADMAP.md` | Sprint 009 marked complete |
| `docs/database/Schema.md` | Updated migrations and org tables |
| `web/README.md` | Migration list corrected (0001–0009) |
| `docs/sprints/SPRINT-009.md` | **New** — sprint record |

---

## Why It Changed

1. **Defence in depth** — Middleware alone is insufficient; handlers must verify the session explicitly.
2. **Tenant readiness** — `organization_id` columns from Sprint 008.5 had no effect until queries filtered on them.
3. **DRY without abstraction** — Nav and download duplication was copy-paste, not intentional variation.
4. **Production hygiene** — Dead code and hardcoded config values create confusion and drift risk.
5. **Documentation truth** — Architecture docs lagged behind 008.5; auditors need an accurate baseline.

---

## Benefits

| Benefit | Detail |
|---------|--------|
| Safer APIs | Unauthenticated requests get 401 from handler, not just middleware |
| Tenant isolation | List/dashboard queries scoped to active organisation |
| Less boilerplate | New admin APIs follow `staffRoute` pattern in ~10 lines |
| Easier maintenance | One nav component, one download helper, one price formatter |
| Clearer docs | Review artefacts give next sprint a prioritised backlog |
| Smaller surface | Removed unused hooks and legacy product fetcher |

---

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Org filter hides legacy unscoped rows | Low | Migration 0009 backfilled all rows to CBC org UUID |
| `staffRoute` masks handler errors as generic 500 | Low | Handlers return specific errors; wrapper only catches unhandled throws |
| Upsert without org on conflict | Low | Single tenant; SKU uniqueness is global today |
| Breaking admin if session expires mid-request | Existing | Same as before; client should redirect to login |
| Type errors from `organization_id` on upsert | Low | Verified via `npm run build` |

---

## What Was Deliberately Not Changed

- No new business features (Treasury, CRM, advanced warehouse)
- No repository pattern layer ( `lib/*` already fills this role)
- No domain event bus (ledgers suffice for current audit needs)
- No RLS policies (planned Sprint 010)
- No `staff_profiles` role checks (planned Sprint 010)
- Public `POST /api/orders` unchanged

---

## Recommended Next Sprint (010)

**Theme:** Multi-tenant production readiness + Warehouse/Treasury foundation

1. **Auth hardening** — Validate `staff_profiles` in `requireStaff()`; reject users without active profile
2. **RLS policies** — Org-scoped read/write on `products`, `orders`, `warehouses`, `suppliers`, `purchase_orders`
3. **`inbound_shipments.organization_id`** — Migration + query scoping
4. **Pagination** — Orders list and products list APIs
5. **Rate limiting** — `POST /api/orders`
6. **Treasury scaffold** — FX rate table, payment status on orders (if business priority confirms)

---

## Verification

```bash
cd web
npm run build
```

All existing admin workflows should function identically for Chosen by Chloe staff:
- Browse/manage orders, inventory, warehouse, purchasing
- Download packing slips (single and bulk)
- Push orders to Shopify
- Receive goods and run stock take
