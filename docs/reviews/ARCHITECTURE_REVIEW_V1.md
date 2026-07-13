# Architecture Review V1 — Thomas OS

**Sprint:** 009 (Architecture Hardening)  
**Date:** July 2026  
**Scope:** Full repository audit — no new business features

---

## 1. Current Architecture

Thomas OS is a **Next.js 16 monolith** with a clear three-tier shape:

```
┌─────────────────────────────────────────────────────────────┐
│  Storefront + Admin UI (React client components)            │
│  app/shop, app/checkout, app/admin/*                        │
└──────────────────────────┬──────────────────────────────────┘
                           │ fetch() / form posts
┌──────────────────────────▼──────────────────────────────────┐
│  API Routes (app/api/*)                                     │
│  middleware.ts — session gate on /admin/* and /api/*        │
│  staffRoute() — requireStaff + Supabase admin client        │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  Service layer (lib/*)                                        │
│  orders, inventory/*, warehouse/*, purchasing/*, thomas/*     │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  Supabase PostgreSQL + Storage                              │
│  Migrations 0001–0009                                       │
└─────────────────────────────────────────────────────────────┘
```

### Platform core (`lib/thomas/`)

| Component | Role |
|-----------|------|
| `tenant/resolve` | Resolves active tenant (currently single: Chosen by Chloe) |
| `tenant/scope` | `getOrganizationId()` for query scoping |
| `auth/require-staff` | Defence-in-depth session check in API handlers |
| `api/staff-route` | Wrapper: auth + admin client + error handling |

### Domain modules

| Module | Service layer | UI | API |
|--------|---------------|-----|-----|
| Orders | `lib/orders.ts` | `/admin/orders` | `/api/orders/*` |
| Inventory | `lib/inventory/*` | `/admin/inventory/*` | `/api/inventory/*` |
| Warehouse | `lib/warehouse/*` | `/admin/warehouse/*` | `/api/warehouse/*` |
| Purchasing | `lib/purchasing/*` | `/admin/purchasing/*` | `/api/purchasing` |
| Auth | `middleware.ts`, Supabase Auth | `/admin/login` | — |
| Tenant | `tenants/chosen-by-chloe/config.ts` | Branding in layout | — |

### Data flow patterns

- **Stock changes:** Always via `createStockMovement()` (ADR-002) → `inventory_balances` → `products.stock` sync.
- **Admin pages:** Client-side `fetch()` to JSON APIs; no direct Supabase from browser for admin ops.
- **Public storefront:** Reads products via server components / anon key where applicable.
- **Order creation:** `POST /api/orders` — public, unauthenticated (by design).

---

## 2. Strengths

1. **Ledger-first inventory** — Immutable `stock_movements` with transactional balance updates is the right foundation for audit and multi-location stock.
2. **Service layer exists** — `lib/orders`, `lib/inventory/*`, `lib/warehouse/*`, `lib/purchasing/*` already separate business logic from route handlers.
3. **Incremental platform extraction** — Sprint 008.5 introduced `lib/thomas/` without a big-bang rewrite.
4. **Tenant config externalised** — Commerce, branding, and email settings live in `tenants/chosen-by-chloe/config.ts`.
5. **Middleware auth** — `/admin/*` and `/api/*` (except public order POST) require a valid session.
6. **Migration discipline** — Numbered SQL migrations with clear sprint ownership.
7. **Documentation culture** — ADRs, sprint notes, product vision, and roadmap already present.

---

## 3. Weaknesses

| Area | Issue |
|------|-------|
| Multi-tenancy | `organization_id` columns exist but were not consistently filtered in queries (fixed Sprint 009) |
| Auth depth | Middleware protected routes but handlers did not call `requireStaff()` (fixed Sprint 009) |
| API boilerplate | Each route duplicated `getSupabaseAdmin()` + try/catch (consolidated via `staffRoute`) |
| UI duplication | Three near-identical nav components; packing slip download logic copied in 3 places |
| Dead code | Legacy `lib/products.ts`, unused `useInventory` / `useWarehouse` hooks |
| `staff_profiles` | Table created in 0009 but not used for role checks or org membership validation |
| RLS | No Row Level Security policies — all data access uses service role |
| Domain events | No formal event bus; only `warehouse_events` and `stock_movements` as implicit ledgers |

---

## 4. Technical Debt

See [TECHNICAL_DEBT.md](./TECHNICAL_DEBT.md) for the full register. High-priority items:

- No RLS on Supabase tables
- `staff_profiles` unused in application code
- `inbound_shipments` lacks `organization_id`
- `products.stock` still denormalised (storefront reads it; ledger is canonical)
- Single-tenant hardcoded in `getActiveTenant()`
- No automated migration runner in CI
- No integration/E2E test suite

---

## 5. Scalability Concerns

| Concern | Current state | Risk at scale |
|---------|---------------|---------------|
| Monolith | All modules in one Next.js app | Deploy coupling; team parallelism limited |
| Service role everywhere | Admin APIs bypass RLS | Fine for single tenant; risky for true multi-tenant SaaS |
| Client-side admin | All admin pages are `"use client"` + fetch | Large bundle; no server-side data prefetch |
| N+1 in bulk ops | Bulk packing slip download loops sequentially | Slow for high order volume |
| No caching layer | Every dashboard hits DB directly | Latency under concurrent staff |
| PDF generation | Synchronous in request handler | CPU-bound; blocks Node event loop at volume |

**Mitigation path (not Sprint 009):** Background jobs for PDF/email, read replicas or materialised views for dashboards, edge caching for storefront, split workers if needed.

---

## 6. Security Concerns

| Concern | Severity | Notes |
|---------|----------|-------|
| Service role in all handlers | Medium | Acceptable while single-tenant + trusted staff; must add RLS before multi-tenant |
| No `staff_profiles` validation | Medium | Any authenticated user can access all admin APIs |
| Public order POST | Low (by design) | Rate limiting and bot protection not implemented |
| Env secrets | Low | `.env.local` pattern documented; no secrets in repo |
| CSRF on admin APIs | Low | Same-origin fetch with session cookies; consider tokens if exposing cross-origin |
| SQL injection | Low | Supabase client parameterises queries |

Sprint 009 improvements: `staffRoute()` wires `requireStaff()` in every protected handler; org-scoped list queries prevent cross-tenant leakage when a second tenant is added.

---

## 7. Performance Concerns

1. **Dashboard aggregation** — Inventory and procurement dashboards compute stats on every request.
2. **Unbounded list queries** — Some list endpoints lack pagination (orders, products).
3. **Warehouse events join** — Dashboard loads recent events with order join.
4. **Image/barcode generation** — PNG rendering in-request for labels and barcodes.

None are blocking for current single-warehouse, single-tenant volume. Monitor when order count exceeds ~1,000/month or concurrent staff exceeds ~5.

---

## 8. Domain Module Assessment

### Orders
- **UI/logic separation:** Good — `lib/orders.ts` handles creation, listing, fulfilment updates.
- **DB in components:** No — admin pages call APIs only.
- **Scalability:** List endpoint needs pagination; otherwise sound.
- **Verdict:** Minor hardening only (org scope, auth).

### Inventory
- **UI/logic separation:** Good — `lib/inventory/*` is comprehensive.
- **DB in components:** No.
- **Scalability:** Ledger model scales; dashboard stats should move to materialised view later.
- **Verdict:** Strongest module architecturally (ADR-002).

### Warehouse
- **UI/logic separation:** Good — picking/packing in `lib/warehouse/*`.
- **DB in components:** No.
- **Scalability:** Event log is appropriate; pick/pack sessions are row-per-order (fine).
- **Verdict:** Ready for feature expansion (Sprint 010+).

### Purchasing
- **UI/logic separation:** Good — `lib/purchasing/suppliers.ts` is the service layer.
- **DB in components:** No.
- **Scalability:** PO receive flow touches inventory correctly via receive helpers.
- **Verdict:** Org scope added; shipments need org column later.

### Authentication
- **Pattern:** Supabase email/password + middleware session check.
- **Gap:** No role-based access; no link to `staff_profiles`.
- **Verdict:** Sufficient for MVP; extend before external staff onboarding.

### Tenant
- **Pattern:** Config file + `organization_id` FK on core tables.
- **Gap:** Runtime tenant resolution is hardcoded to CBC.
- **Verdict:** Foundation laid in 008.5; Sprint 009 adds query scoping.

---

## 9. Shared Services Review

| Before | After (Sprint 009) |
|--------|-------------------|
| Duplicated nav in AdminNav, PurchasingNav, OpsNav | `components/thomas/ModuleNav` |
| Packing slip download in 3 files | `lib/client/download-packing-slip.ts` |
| `formatOrderPrice` in order-email + format.ts | Single source: `lib/format.ts` |
| Per-route auth/client boilerplate | `lib/thomas/api/staff-route.ts` |
| Hardcoded CNY→GBP in checkout | `getDisplayCnyToGbpRate()` from tenant config |

**Not introduced (deliberately):**
- Generic repository base classes — `lib/*` already serves this role.
- Domain event bus — documented as future option; existing ledgers suffice today.

---

## 10. Repository Pattern Decision

The `lib/*` modules **are** the repository/service layer. They:

- Accept `SupabaseClient` as first argument (testable, explicit).
- Return `{ data, error }` tuples consistent with Supabase conventions.
- Encapsulate table names and join shapes.

Adding a separate `repositories/` layer would duplicate this without benefit. Sprint 009 adds `getOrganizationId()` scoping at the service boundary instead.

---

## 11. Domain Events Decision

**Recommendation: defer implementation.**

Existing mechanisms cover audit needs:

| Event | Current mechanism |
|-------|-------------------|
| OrderCreated | `orders` row + confirmation email |
| InventoryAllocated | `stock_movements` ledger |
| PackingSlipGenerated | On-demand PDF; `warehouse_events` optional |
| PurchaseOrderReceived | PO status update + goods receipt + stock movement |

A lightweight in-process event emitter would add indirection without clear benefit until Treasury (payment events) or CRM (customer lifecycle) need cross-module reactions. Revisit in Sprint 010+.

---

## 12. Configuration Review

| Item | Location | Status |
|------|----------|--------|
| Tenant branding/commerce | `tenants/chosen-by-chloe/config.ts` | ✅ Centralised |
| Supabase keys | `.env.local` | ✅ Documented |
| Shopify/Resend | `.env.local` | ✅ Server-only |
| CNY→GBP rate | Tenant config | ✅ Fixed Sprint 009 |
| Order number prefix/start | Tenant config | ✅ |
| Feature flags | None | Add when needed (Treasury, multi-storefront) |

Removed: dead `lib/products.ts` (hardcoded anon client duplicate).

---

## 13. Suggested Improvements (Prioritised)

### Done in Sprint 009
- [x] `staffRoute()` on all protected API handlers
- [x] `getOrganizationId()` scoping on list/dashboard queries
- [x] `ModuleNav` shared component
- [x] Shared packing slip download helper
- [x] Remove dead code
- [x] `server-only` on server modules
- [x] Documentation sync

### Sprint 010 (recommended)
- Wire `staff_profiles` — validate org membership on `requireStaff()`
- Add RLS policies for defence-in-depth
- Pagination on orders and products list APIs
- `organization_id` on `inbound_shipments`
- Rate limiting on `POST /api/orders`

### Later
- Background job queue (PDF, email, Shopify sync retries)
- Domain events when Treasury/CRM need cross-module hooks
- Extract storefront to tenant-aware routing (`/[tenant]/shop`)

---

## 14. Conclusion

Thomas OS has a **sound modular monolith** architecture with a proper inventory ledger and emerging platform core. Sprint 009 closes the gap between "platform foundation migrated" and "platform foundation enforced" by wiring auth, org scoping, and shared utilities — without rewriting working code.

The system is **production-ready for single-tenant Chosen by Chloe** operations. Multi-tenant SaaS readiness requires RLS, staff profile validation, and tenant routing — planned for Sprint 010.
