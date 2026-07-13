# Project Thomas — Architecture Review

**Document version:** 1.0  
**Date:** 13 July 2026  
**Repository:** `chosen-by-chloe-order-portal` (pending rename to `thomas-os`)  
**First tenant:** Chosen by Chloe  

---

## Executive Summary

This repository began as a customer order portal for Chosen by Chloe. Through Sprints 005–008 it has evolved into a **single-tenant operational monolith** covering commerce, fulfilment, inventory, warehouse operations, and procurement.

The codebase contains the **seed of a retail operating system**, but it is not yet structured as one. Business logic, branding, tenancy, and platform concerns are interleaved. Admin UI routes exist for most modules, but **API security, multi-tenancy, and documentation are behind the implementation**.

**Current maturity level:** **MVP / Alpha** — one business, one database, one deployment, strong domain prototypes, weak platform boundaries.

**Strategic direction:** Rebrand and restructure as **Thomas OS** (platform) with **Chosen by Chloe** as the first application/tenant layer.

---

## Part 1 — Architecture Review

### 1. Current Folder Structure

```
chosen-by-chloe-order-portal/
├── docs/                          # Platform vision (partial, stale in places)
│   ├── adr/                       # Architecture decision records
│   ├── database/                  # Schema documentation
│   ├── sprints/                   # Sprint 006 only
│   └── vision/                    # Product vision, architecture, roadmap
├── PROJECT_REVIEW.md              # This document
└── web/                           # Entire application (Next.js monolith)
    ├── app/
    │   ├── page.tsx               # Storefront (tenant: CBC)
    │   ├── checkout/              # Customer checkout (tenant)
    │   ├── admin/                 # Admin console + module UIs (platform-ish UI, CBC branding)
    │   └── api/                   # REST-ish API routes (platform logic, no auth)
    ├── components/                # Shared UI (mixed tenant + module)
    ├── context/                   # CartContext only
    ├── hooks/                     # Thin API wrappers
    ├── lib/                       # Business logic (de facto service layer)
    ├── types/                     # Domain TypeScript types
    ├── supabase/migrations/       # 8 sequential SQL migrations
    ├── docs/sprints/              # Sprint 007–008 (split from root docs/)
    └── scripts/                   # CLI utilities (import, images, email)
```

**Observation:** Everything lives inside `web/`. There is no separation between Thomas platform code and Chosen by Chloe tenant configuration. Documentation is split across `docs/` and `web/docs/`.

---

### 2. Current Application Architecture

| Layer | Implementation | Thomas vs CBC |
|-------|----------------|---------------|
| **Presentation** | Next.js App Router, client-heavy admin pages | CBC branding in layouts; module patterns are reusable |
| **API** | Next.js Route Handlers (`app/api/*`) | Domain logic is reusable; route layout is ad hoc |
| **Service** | `lib/*` modules (informal, no interfaces) | Strong inventory/warehouse/purchasing services |
| **Data** | Supabase PostgreSQL via service-role client | Single schema, no `tenant_id` |
| **Auth** | Supabase Auth, middleware on `/admin` only | Platform concern, minimally implemented |
| **Integrations** | Shopify GraphQL, Resend email | CBC-specific config; patterns are reusable |
| **Jobs / queues** | None | — |
| **Events** | `warehouse_events` table only | Partial audit pattern |

**Architecture pattern today:** Modular monolith — domain folders (`lib/inventory`, `lib/warehouse`, `lib/purchasing`) with UI colocated in `app/admin/*`.

**Data flow (orders → inventory):**

```
Customer checkout (POST /api/orders)
  → CAS decrement products.stock (legacy)
  → recordCustomerOrderMovements() (ledger)
  → order confirmation email (Resend)

Admin fulfilment
  → Pick list → Pack session → Dispatch
  → warehouse_status on orders

Procurement
  → PO create → inbound shipment → receivePurchaseOrder()
  → receiveGoods() → stock_movements → inventory_balances
```

**Gap vs Thomas vision:** No event bus, no plugin boundary, no tenant context propagation, no unified identity model for customers vs staff.

---

### 3. Database Schema

**Migrations (0001–0008):**

| Migration | Domain | Key additions |
|-----------|--------|---------------|
| 0001–0003 | Commerce | `orders.notes`, checkout fields, `order_number` |
| 0004–0005 | Fulfilment | `fulfilment_status`, Shopify fields, customer name/address |
| 0006 | Inventory | Product master extensions, warehouses, `inventory_balances`, `stock_movements`, goods receipts, stock take, alerts |
| 0007 | Warehouse | `warehouse_status`, pick lists, pack sessions, verifications, events |
| 0008 | Purchasing | `suppliers`, `brands`, `purchase_orders`, shipments, landed cost columns |

**Core entity groups:**

```
Commerce:     products, orders, order_items
Inventory:    warehouses, warehouse_locations, inventory_balances, stock_movements
Receiving:    goods_receipts, goods_receipt_lines
Stock take:   stock_take_sessions, stock_take_lines
Warehouse:    warehouse_pick_lists, warehouse_pick_lines, warehouse_pack_sessions,
              warehouse_pack_verifications, warehouse_events
Procurement:  suppliers, brands, purchase_orders, purchase_order_lines,
              inbound_shipments, supplier_documents, supplier_performance
Auth:         Supabase auth.users (external to app migrations)
```

**Schema strengths:**
- Immutable stock movement ledger (ADR-002) — correct for multi-tenant OS
- Location-level inventory balances — warehouse-first design
- PO → goods receipt → inventory pipeline is wired
- Rich product master (dimensions, HS code, landed cost)

**Schema weaknesses for Thomas:**
- **No `organization_id` / `tenant_id`** on any business table
- **No RLS policies** in migrations — all access via service role
- **No `users` / `roles` / `permissions`** mapping for staff
- **No customer accounts** table (orders are anonymous/guest)
- **CBC-seeded data** in migrations (London Garage, Main Warehouse)
- **`products.stock`** denormalized field creates dual-write risk with ledger
- **Mixed ID types** (`products.id` bigint vs UUIDs elsewhere)
- **Treasury tables** not started (forward contracts, payments, FX)
- **No soft-delete / archival** pattern documented

---

### 4. Component Hierarchy

```
app/layout.tsx
└── CartProvider (tenant storefront)
    ├── / (page.tsx) → Catalog → ProductCard, StickyCart
    ├── /checkout
    └── /admin/layout.tsx
        ├── /admin (console hub)
        ├── /admin/login
        ├── /admin/orders/*          (inline page logic)
        ├── /admin/inventory/layout → AdminNav
        ├── /admin/warehouse/layout → OpsNav (WarehouseUI)
        └── /admin/purchasing/layout → PurchasingNav

components/
├── Storefront:  Catalog, ProductCard, StickyCart
├── inventory:   AdminNav (cross-module links)
├── warehouse:   WarehouseUI (OpsNav, ScanInput, BigButton, StatusPill)
├── purchasing:  PurchasingNav
└── pdf:         PackingSlip (@react-pdf template)
```

**Pattern:** Admin pages are large client components with local `useState` + `fetch()`. Shared primitives exist only for warehouse mobile UI and nav bars. **No design system** beyond Tailwind tokens (`cocoa`, `espresso`, `cream`, etc.).

**Thomas implication:** UI components for scan inputs, status pills, dashboard stat cards, and data tables should become `@thomas/ui` primitives. Branding (logo, colours, copy) belongs in the CBC tenant layer.

---

### 5. API Architecture

**20 API route files** grouped by domain:

| Prefix | Style | Auth |
|--------|-------|------|
| `/api/orders` | REST | None (service role) |
| `/api/inventory/*` | REST | None |
| `/api/warehouse/*` | REST + action POST bodies | None |
| `/api/purchasing` | **Monolithic** `?resource=` switch | None |

**Runtime:** All routes use `export const runtime = "nodejs"` and `getSupabaseAdmin()` (service role).

**Inconsistencies:**
- Purchasing uses one endpoint with a `resource` parameter; other modules use path-based REST
- Warehouse picking/packing use `action` in POST body (RPC-style)
- Storefront reads `products` directly from browser Supabase client (bypasses API)

**Missing for Thomas:**
- API versioning (`/api/v1/`)
- Authentication middleware on admin APIs
- Tenant context header or JWT claims
- Rate limiting, idempotency keys for order creation
- OpenAPI / contract documentation
- Webhook outbound events

---

### 6. State Management

| Concern | Mechanism |
|---------|-----------|
| Customer cart | `CartContext` + `localStorage` (`cbc-cart-v1`) |
| Admin modules | Component-local `useState` / `useEffect` |
| Server state | Direct `fetch()` to API routes (no cache layer) |
| Forms | Uncontrolled/controlled local state |

**No** React Query, SWR, Zustand, or Redux. **No** server actions for admin mutations.

**Hooks (thin wrappers):**
- `useInventory`, `useWarehouse`, `useShopify` — fetch helpers only

**Thomas recommendation:** Adopt TanStack Query (or similar) at platform level for admin data fetching; keep cart context for storefront or move to tenant package.

---

### 7. Authentication

| Surface | Protection |
|---------|------------|
| `/admin/*` pages | Supabase Auth + middleware (`@supabase/ssr` cookies) |
| `/api/*` | **Unprotected** — service role, no session check |
| Storefront | Public |
| Supabase DB | Service role bypasses RLS |

**Login flow:** Email/password → `signInWithPassword` → cookie session → middleware redirect.

**Gaps (critical):**
- Anyone who discovers API URLs can read/write all data
- No role-based access (picker vs buyer vs admin)
- No audit of which staff user performed warehouse/procurement actions (partial: `warehouse_events.user_name` is optional)
- `lib/supabase/server.ts` exists but is unused
- No MFA, no SSO, no API keys for integrations

---

### 8. Storage

| Type | Location |
|------|----------|
| Product images | Supabase Storage (via upload scripts) |
| PDFs | Generated on-the-fly (`@react-pdf/renderer`) |
| Barcodes | Generated on-the-fly (`bwip-js`, `qrcode`) |
| Cart | Browser `localStorage` |
| Sessions | Supabase Auth cookies |
| Supplier documents | Table exists (`supplier_documents`) — upload UI not implemented |

**No** CDN abstraction, no asset versioning strategy, no tenant-scoped storage buckets.

---

### 9. Technical Debt

| Item | Severity | Description |
|------|----------|-------------|
| API unauthenticated | **Critical** | Service role exposed via public API routes |
| Dual stock write | **High** | `products.stock` CAS + movement ledger on order create |
| No multi-tenancy | **High** | Cannot onboard second retailer without fork |
| CBC hardcoding | **Medium** | Order prefix, brand, emails, FX rate, Shopify tags |
| Duplicate types | **Medium** | `lib/types.Product` vs `types/inventory.ProductMaster` |
| Duplicate order libs | **Medium** | `lib/order.ts`, `lib/orders.ts`, `types/order.ts` |
| Dead code | **Low** | `lib/products.ts`, `lib/supabase/server.ts` unused |
| Doc drift | **Medium** | Vision/roadmap/README behind code (Sprint 008 done, auth done) |
| Split doc locations | **Low** | `docs/` vs `web/docs/` |
| No tests | **High** | Zero automated test coverage |
| Monolithic purchasing API | **Medium** | Hard to version and document |
| Inline admin pages | **Medium** | 200–300 line page components, hard to reuse |

---

### 10. Areas Requiring Refactoring

**Before adding Treasury or Native Commerce:**

1. **Platform boundary extraction** — Separate Thomas core from CBC tenant config
2. **API authentication** — Verify Supabase session or service token on all `/api/*` admin routes
3. **Single stock path** — Remove CAS on `products.stock`; ledger becomes sole source of truth
4. **Tenant column** — Add `organization_id` to all business tables (migration strategy required)
5. **Unified product model** — Merge `Product` and `ProductMaster` types
6. **Service layer contracts** — Formal interfaces for inventory, orders, warehouse, purchasing
7. **Admin data layer** — Shared hooks with caching instead of per-page fetch boilerplate
8. **Documentation consolidation** — Single `docs/` tree at repo root
9. **Repository rename** — `chosen-by-chloe-order-portal` → `thomas-os`

---

### 11. Scalability Concerns

| Area | Risk | Notes |
|------|------|-------|
| Database | Medium | Single Postgres instance; no read replicas, no partitioning |
| API | Medium | Serverless functions; long PDF/barcode generation on request thread |
| Inventory ledger | Low–Medium | Append-only table will grow; needs archival strategy |
| Concurrent orders | Medium | CAS loop on `products.stock` — should be removed |
| Multi-tenant | **Blocker** | Current schema cannot scale to N retailers |
| Background jobs | High | No queue for emails, Shopify sync, PO reminders |
| File generation | Medium | PDF/barcode per request — should move to job queue at scale |
| Real-time | None | No WebSocket/subscriptions for warehouse floor |

---

### 12. Security Concerns

| Issue | Impact |
|-------|--------|
| Unauthenticated admin APIs | Full database read/write if URLs known |
| Service role on every API route | Bypasses all RLS; single key compromise = total breach |
| No input validation library | Ad hoc validation in route handlers |
| No CSRF protection on APIs | Cookie auth + API calls need SameSite + token pattern |
| Secrets in `.env.local` | Standard, but no rotation/runbook documented |
| Admin users in Supabase Auth | No role assignment; any auth user = full admin |
| Customer PII in orders | No encryption-at-rest policy, no retention/GDPR tooling |
| Shopify token | Server-only (good) but no scoped permissions documented |

---

### 13. Performance Concerns

| Area | Issue |
|------|-------|
| Storefront | Client-side Supabase query on every homepage load |
| Admin dashboards | Multiple sequential fetches; no parallel batch endpoints |
| N+1 queries | Some list endpoints may over-fetch (needs profiling) |
| PDF generation | Synchronous in API request |
| Bundle size | `@react-pdf`, `bwip-js` loaded for server routes |
| Static generation | Most admin pages are client components; no ISR |
| Indexes | Good coverage on status columns; ledger may need time-based indexes |

---

### 14. Strengths

1. **Correct inventory mental model** — Immutable ledger + materialized balances (ADR-002)
2. **End-to-end operational flows** — Order → pick → pack → dispatch and PO → receive → stock
3. **Domain-oriented `lib/` structure** — Clear modules for inventory, warehouse, purchasing
4. **Mobile-first warehouse UI** — Appropriate for floor operations
5. **Typed TypeScript** — Domain types per module in `types/`
6. **Sequential migrations** — Schema evolution is traceable
7. **Barcode/PDF infrastructure** — Foundation for labels and documents
8. **Shopify integration pattern** — Draft order push with duplicate detection
9. **Admin console hub** — Central navigation model works
10. **Sprint-driven delivery** — Features map to business capabilities

---

### 15. Weaknesses

1. **Not multi-tenant** — Fundamentally a single-business app
2. **Security model incomplete** — UI gated, APIs wide open
3. **Platform vs tenant conflation** — CBC branding and Thomas logic intertwined
4. **No test suite** — Regression risk increases with every sprint
5. **Documentation lag** — Vision docs describe "planned" features that are built
6. **Inconsistent API design** — REST, RPC, and monolithic patterns coexist
7. **No customer accounts or CRM** — Orders only, no lifetime value view
8. **No treasury, returns, shipping carriers** — Roadmap items not started
9. **No observability** — No structured logging, metrics, or error tracking
10. **Monolith scaling ceiling** — All modules deploy together

---

## Part 2 — Project Review

### Current Maturity Level

| Dimension | Level (1–5) | Notes |
|-----------|-------------|-------|
| Commerce | 3 | Storefront + checkout work; not "native commerce OS" yet |
| Inventory | 4 | Ledger, locations, receiving, stock take — strong |
| Warehouse | 3 | Pick/pack/dispatch UI; barcode scan basic |
| Procurement | 3 | PO lifecycle + receive; documents upload missing |
| Treasury | 0 | Not started |
| CRM / Accounts | 0 | Not started |
| Auth / Platform | 2 | Admin login only; no RBAC, no API auth |
| Multi-tenancy | 0 | Not designed |
| AI | 0 | Not started |
| **Overall** | **2.5 / 5** | **Alpha MVP** — one tenant, rich ops, weak platform |

---

### Recommended Architecture

**Target: Modular platform monorepo (Phase 1) → extractable services (Phase 2)**

```
thomas-os/
├── apps/
│   ├── thomas-admin/          # Admin shell (or keep in web/app/admin)
│   └── chosen-by-chloe/       # Tenant storefront + config
├── packages/
│   ├── thomas-core/           # Auth, tenant context, errors, logging
│   ├── thomas-db/             # Migrations, schema types, RLS policies
│   ├── thomas-commerce/       # Orders, checkout, pricing
│   ├── thomas-inventory/      # Ledger, balances, products
│   ├── thomas-warehouse/      # Pick, pack, dispatch
│   ├── thomas-procurement/    # Suppliers, POs, receiving
│   ├── thomas-treasury/       # Sprint 009+
│   ├── thomas-ui/             # Shared admin components
│   └── thomas-integrations/   # Shopify, Resend, carriers
├── tenants/
│   └── chosen-by-chloe/
│       ├── brand.ts
│       ├── theme.ts
│       └── config.ts
└── docs/
```

**Phase 1 (now):** Stay in one Next.js app but **enforce folder boundaries** and extract tenant config.  
**Phase 2 (before second retailer):** Extract `packages/*`, add `organization_id`, enable RLS.  
**Phase 3 (scale):** Background workers, event bus, optional service extraction.

**Principles:**
- Thomas owns domain logic and schema
- Tenants own branding, channel config, and feature flags
- All stock changes go through `createStockMovement()` (keep ADR-002)
- APIs require authenticated staff context

---

### Immediate Improvements (0–4 weeks)

| Priority | Action |
|----------|--------|
| P0 | Add API auth middleware — verify Supabase session on all `/api/*` except public order create |
| P0 | Document and run migrations 0005–0008 in production Supabase |
| P0 | Rename repo to `thomas-os`; update README and package name |
| P1 | Remove `products.stock` CAS; rely on ledger + balance check for availability |
| P1 | Consolidate docs into single `docs/` tree; update ROADMAP to reflect Sprints 007–008 |
| P1 | Extract `tenants/chosen-by-chloe/` config (brand, order prefix, currency, emails) |
| P1 | Add `organization_id` column (nullable, default single org) to prepare multi-tenancy |
| P2 | Standardize API patterns — path-based REST per domain, deprecate `resource` switch |
| P2 | Add Vitest + integration tests for `createStockMovement()` and order create |
| P2 | Structured logging in API routes (request ID, user ID, tenant ID) |

---

### Future Improvements (1–6 months)

- Row Level Security policies keyed on `organization_id`
- Role-based access control (admin, warehouse_operator, buyer, viewer)
- Customer accounts + order history (CRM foundation)
- Background job runner (Inngest, Trigger.dev, or Supabase Edge Functions)
- Event outbox (`domain_events` table) for integrations
- Shipping carrier adapters (Royal Mail, DPD)
- Returns module (RMA, restock movements)
- Treasury module (Sprint 009)
- Native commerce storefront as Thomas module (Sprint 010)
- Analytics warehouse / dashboards
- AI assistants for demand forecasting, pick path optimization

---

### Updated Roadmap

See **Part 3** for full roadmap comparison. Proposed revision:

| Sprint | Name | Status | Change |
|--------|------|--------|--------|
| 001–004 | Storefront & Checkout | ✅ Done | Rename scope to "Tenant Commerce (CBC)" |
| 005 | Order Fulfilment | ✅ Done | Becomes Thomas Commerce + Integrations |
| 006 | Inventory | ✅ Done | Thomas Inventory module |
| 007 | Warehouse | ✅ Done | Thomas Warehouse module |
| 008 | Purchasing | ✅ Done | Thomas Procurement module |
| **008.5** | **Platform Foundation** | 🆕 **Insert** | API auth, tenant config extraction, repo rename, doc consolidation |
| 009 | Treasury | Planned | Unchanged — needs platform foundation first |
| 010 | Native Commerce | Planned | Reframe as Thomas Commerce (multi-tenant storefront) |
| 011 | CRM & Customer Accounts | 🆕 New | Required for "operate entire retail business" |
| 012 | Shipping & Returns | 🆕 New | Carriers, labels, RMA |
| 013 | Analytics & AI | 🆕 New | Dashboards, forecasting |

---

### Suggested Module Boundaries

| Thomas Module | Owns | Does NOT own |
|---------------|------|--------------|
| **thomas-core** | Auth, tenants, users, roles, audit | Business domain rules |
| **thomas-commerce** | Orders, checkout, pricing, promotions | Stock levels (reads inventory) |
| **thomas-inventory** | Products, ledger, balances, alerts | Warehouse pick execution |
| **thomas-warehouse** | Pick/pack/dispatch, floor UI | PO creation |
| **thomas-procurement** | Suppliers, POs, inbound shipments | Payment execution |
| **thomas-treasury** | FX, payments, cash forecast | Order capture |
| **thomas-integrations** | Shopify, email, carriers | Core business rules |
| **tenant (CBC)** | Brand, theme, channel keys, order prefix | Inventory ledger logic |

**Integration rule:** Modules communicate via service calls and domain events, not direct table writes across boundaries.

---

### Suggested Folder Structure

**Near-term (within current monolith):**

```
web/
├── app/
│   ├── (storefront)/              # Tenant public routes
│   │   ├── page.tsx
│   │   └── checkout/
│   ├── (platform)/admin/          # Thomas admin (tenant-agnostic shell)
│   │   ├── page.tsx               # Console
│   │   ├── login/
│   │   ├── commerce/orders/       # was admin/orders
│   │   ├── inventory/
│   │   ├── warehouse/
│   │   └── procurement/           # was purchasing
│   └── api/v1/                    # Versioned APIs
│       ├── commerce/
│       ├── inventory/
│       ├── warehouse/
│       └── procurement/
├── packages/                      # Future: move lib/* here
├── tenants/chosen-by-chloe/       # Brand, config, theme
├── lib/                           # Keep until packages extracted
└── components/
    ├── thomas/                    # Platform UI primitives
    └── tenants/chosen-by-chloe/   # Tenant-specific components
```

---

### Suggested Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Repo | `thomas-os` | — |
| Package scope | `@thomas/*` | `@thomas/inventory` |
| Tenant config | `tenants/{slug}/` | `tenants/chosen-by-chloe/` |
| API routes | `/api/v1/{module}/{resource}` | `/api/v1/inventory/products` |
| DB tables | `{module}_{entity}` or plain domain | `stock_movements`, `purchase_orders` |
| Migrations | `YYYYMMDD_{description}.sql` | Move away from sprint numbers |
| Types | `{Entity}Record`, `{Entity}Input` | `OrderRecord`, `CreateMovementInput` |
| Services | verb-noun functions | `createStockMovement`, `generatePickList` |
| Admin routes | `/admin/{module}` | `/admin/warehouse` |
| Order numbers | Tenant-configured prefix | CBC: `CBC9001`; other tenants differ |
| Env vars | `THOMAS_*` for platform, `TENANT_*` or `CBC_*` for tenant | `CBC_SHOPIFY_STORE` |

---

### Suggested Database Improvements

1. **Add `organizations` table** — id, name, slug, settings jsonb
2. **Add `organization_id`** to all business tables (backfill single org)
3. **Enable RLS** — policies scoped to `organization_id` from JWT
4. **Add `staff_profiles`** — links `auth.users` to org + role
5. **Add `customers` table** — CRM foundation, link to orders
6. **Add `domain_events` table** — event outbox for integrations
7. **Deprecate `products.stock`** — computed view or materialized column from balances
8. **Normalize ID strategy** — document bigint vs UUID; prefer UUID for new tables
9. **Add missing FK** — `orders.organization_id`, `warehouse_events.actor_id`
10. **Treasury schema (Sprint 009)** — `bank_accounts`, `payments`, `fx_rates`, `forward_contracts` with `organization_id`

---

### Suggested API Improvements

1. **Auth middleware** — `withAuth(handler)` wrapper for admin routes
2. **Version prefix** — `/api/v1/`
3. **Consistent REST** — split `/api/purchasing` into `/api/v1/procurement/*`
4. **Public vs private** — explicit `publicRoutes` list (order create, product catalog)
5. **Error envelope** — `{ success, error, code, details }` everywhere
6. **Pagination** — cursor-based on list endpoints
7. **Idempotency** — `Idempotency-Key` header on order create
8. **Batch endpoints** — dashboard stats in one call per module
9. **OpenAPI spec** — generate from route definitions
10. **Webhook dispatch** — on order.created, stock.below_threshold, po.received

---

### Suggested Reusable Components (`@thomas/ui`)

| Component | Used by |
|-----------|---------|
| `StatCard` | All dashboards |
| `DataTable` | Orders, POs, products, movements |
| `StatusPill` | Warehouse, orders, POs |
| `ScanInput` | Warehouse pick/pack, stock take |
| `BigButton` | Mobile warehouse floor |
| `ModuleNav` | Admin sub-navigation |
| `EmptyState` | All list pages |
| `ConfirmDialog` | Destructive actions |
| `PageHeader` | Admin layout consistency |
| `FormField` | CRUD forms |

---

### Suggested Service Layer

Formalize `lib/*` as services with consistent return type `{ data, error }`:

```
services/
├── commerce/
│   ├── orders.service.ts      # create, list, get, updateStatus
│   └── checkout.service.ts    # validate, price
├── inventory/
│   ├── movements.service.ts   # createStockMovement (canonical)
│   ├── products.service.ts
│   └── balances.service.ts
├── warehouse/
│   ├── picking.service.ts
│   ├── packing.service.ts
│   └── dispatch.service.ts
├── procurement/
│   ├── suppliers.service.ts
│   ├── purchase-orders.service.ts
│   └── receiving.service.ts
└── platform/
    ├── auth.service.ts
    ├── tenant.service.ts
    └── audit.service.ts
```

Route handlers become thin: validate input → call service → return response.

---

### Suggested Package Structure (Medium-term)

```
packages/thomas-inventory/
├── src/
│   ├── services/
│   ├── types/
│   └── index.ts
├── package.json
└── tsconfig.json
```

Apps import: `import { createStockMovement } from '@thomas/inventory'`.

---

## Part 3 — Roadmap Comparison

### Existing Roadmap (from `docs/vision/ROADMAP.md`)

**Completed (documented):** Sprints 001–006  
**Next (documented):** Purchase orders, admin auth, Shopify sync, channels, barcode hardware, manufacturing

### Actual Implementation State

| Sprint | Documented | Code Reality |
|--------|------------|--------------|
| 005 Fulfilment | ✅ Done | ✅ Done |
| 006 Inventory | ✅ Done | ✅ Done |
| 007 Warehouse | Not in roadmap doc | ✅ Done |
| 008 Purchasing | Listed as "next" | ✅ Done |
| Admin auth | Listed as "next" | ✅ Done (UI only; APIs open) |
| 009 Treasury | Not documented | ❌ Not started |
| 010 Native Commerce | Not documented | ❌ Not started |

### Should the Roadmap Change?

**Yes.** The roadmap should change for three reasons:

1. **Project redefinition** — The goal is no longer "Chosen by Chloe OS" but **Project Thomas**, a multi-tenant retail operating system. The roadmap must add a **Platform Foundation** phase and separate tenant-specific work from platform work.

2. **Documentation is behind reality** — Sprints 007, 008, and admin auth are implemented but not reflected in `docs/vision/ROADMAP.md` or `PRODUCT_VISION.md`. Continuing without updating the roadmap will cause architectural drift.

3. **Security and tenancy blockers** — Treasury (009) and Native Commerce (010) both assume a trustworthy platform layer. Shipping payment data and multi-storefront commerce on unauthenticated APIs and a single-tenant schema would compound technical debt.

**The roadmap should not change** in terms of **module sequence priority** — Inventory → Warehouse → Procurement → Treasury → Commerce is the correct operational dependency order. Fulfilment before warehouse was pragmatic for CBC; Thomas should document this as the canonical module stack.

### Proposed Revised Roadmap

```
Phase 0 — Foundation (NOW)
  Sprint 008.5  Platform Foundation
                - Rename to thomas-os
                - API authentication
                - Tenant config extraction
                - Documentation reconciliation
                - organization_id preparation

Phase 1 — Operations (DONE)
  Sprint 005    Order Fulfilment        ✅
  Sprint 006    Inventory               ✅
  Sprint 007    Warehouse               ✅
  Sprint 008    Purchasing              ✅

Phase 2 — Financial
  Sprint 009    Treasury
                - FX rates, forward contracts
                - Supplier payments
                - Cash forecast
                - Landed cost automation (extend 008)

Phase 3 — Commerce
  Sprint 010    Native Commerce
                - Multi-tenant storefront
                - Promotions, collections
                - Customer accounts
                - Replace direct Supabase storefront queries

Phase 4 — Growth
  Sprint 011    CRM & Customer Accounts
  Sprint 012    Shipping & Returns
  Sprint 013    Analytics & AI

Phase 5 — Ecosystem
  Sprint 014    Channel Integrations (Shopify two-way, Amazon, Xiaohongshu)
  Sprint 015    Manufacturing & Bundles
```

---

## Part 4 — Thomas vs Chosen by Chloe Classification

| Asset | Thomas (platform) | CBC (tenant) |
|-------|-------------------|--------------|
| `lib/inventory/movements.ts` | ✅ | |
| `lib/warehouse/*` | ✅ | |
| `lib/purchasing/*` | ✅ | |
| `lib/orders.ts` (generic) | ✅ | |
| `lib/order-number.ts` (CBC prefix) | | ✅ |
| `lib/brand.ts` | | ✅ |
| `lib/currency.ts` (fixed 9.25) | | ✅ (tenant config) |
| `lib/shopify/*` (adapter) | ✅ (adapter) | ✅ (credentials) |
| `components/pdf/PackingSlip.tsx` | ✅ (template) | ✅ (branding) |
| `app/page.tsx` storefront | | ✅ |
| `app/checkout/` | ✅ (flow) | ✅ (fields, copy) |
| Warehouse seed data in SQL | | ✅ (should move to seed script) |
| Admin console shell | ✅ | |
| Email templates | ✅ (engine) | ✅ (copy, recipients) |

**Rule of thumb:** If a second premium retailer would need the same code unchanged, it is Thomas. If they would configure or replace it, it is tenant.

---

## Part 5 — Rename Checklist (`chosen-by-chloe-order-portal` → `thomas-os`)

- [ ] Rename GitHub repository
- [ ] Update `package.json` name to `thomas-os` or `@thomas/web`
- [ ] Update README title and description
- [ ] Replace "Chosen by Chloe OS" in admin UI with "Thomas" (tenant name shown as context)
- [ ] Move CBC branding to `tenants/chosen-by-chloe/`
- [ ] Update Vercel project name and env var documentation
- [ ] Update `docs/vision/PRODUCT_VISION.md` → Thomas vision + CBC as tenant case study
- [ ] Add `CONTRIBUTING.md` with Thomas/CBC boundary rules
- [ ] Keep `chosenbychloe.com` storefront domain — tenant routing, not repo name

---

## Conclusion

The repository is a **functioning single-tenant retail operations prototype** with genuinely strong inventory and warehouse foundations. It is **not yet** Project Thomas — it is Chosen by Chloe's custom app with Thomas-shaped modules buried inside a monolith.

The highest-leverage next step is **not a new feature** but **Sprint 008.5: Platform Foundation** — secure the APIs, extract tenant config, add `organization_id`, rename to `thomas-os`, and reconcile documentation. Then Treasury and Native Commerce can ship on solid ground.

**Thomas readiness score: 35/100**  
(Strong domain logic, weak platform infrastructure.)

---

*This document is architectural guidance only. No code changes were made as part of this review.*
