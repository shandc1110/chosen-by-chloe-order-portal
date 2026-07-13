# Technical Debt Register — Thomas OS

**Last updated:** Sprint 009 (July 2026)  
**Owner:** Platform engineering

Items are prioritised **P0** (block production/multi-tenant) → **P3** (nice to have).

---

## P0 — Security & multi-tenant readiness

| ID | Item | Impact | Effort | Notes |
|----|------|--------|--------|-------|
| TD-001 | No Row Level Security (RLS) | Any service-role leak exposes all data | Medium | Add policies per table when enabling multi-tenant |
| TD-002 | `staff_profiles` unused | Any auth user can access admin APIs | Small | Extend `requireStaff()` to verify org membership + role |
| TD-003 | Partial org scoping | Some tables unscoped (shipments, events) | Small | `inbound_shipments` needs `organization_id` column |
| TD-004 | Public order POST unrate-limited | Abuse / spam orders | Small | Add rate limit middleware or Supabase edge function |

---

## P1 — Maintainability & correctness

| ID | Item | Impact | Effort | Notes |
|----|------|--------|--------|-------|
| TD-005 | Single hardcoded tenant | Cannot onboard tenant #2 without code change | Medium | Dynamic tenant resolution from hostname or path |
| TD-006 | No list pagination | Performance degrades with data growth | Medium | Orders, products, movements lists |
| TD-007 | `products.stock` dual representation | Drift risk if ledger bypassed | Low | Storefront still reads denormalised column; ledger is canonical per ADR-002 |
| TD-008 | Admin UI 100% client-side | Larger bundles, no SSR data | Medium | Gradual migration to server components where valuable |
| TD-009 | No automated migration CI | Schema drift between environments | Small | `scripts/apply-migration.ts` exists; wire to deploy pipeline |
| TD-010 | Bulk packing slip sequential download | Slow for large selections | Small | Parallelise with concurrency limit |

---

## P2 — Operations & observability

| ID | Item | Impact | Effort | Notes |
|----|------|--------|--------|-------|
| TD-011 | No structured logging | Hard to debug production issues | Medium | Add request ID + module tags |
| TD-012 | No health check endpoint | Load balancer / uptime monitoring | Small | `GET /api/health` |
| TD-013 | Synchronous PDF in request | Blocks under load | Medium | Queue PDF generation |
| TD-014 | No integration test suite | Regressions caught manually | Large | Start with order create + stock movement |
| TD-015 | Dashboard stats computed live | DB load on every page view | Medium | Materialised views or cached aggregates |

---

## P3 — Future architecture

| ID | Item | Impact | Effort | Notes |
|----|------|--------|--------|-------|
| TD-016 | No domain event bus | Cross-module reactions require tight coupling | Medium | Defer until Treasury/CRM |
| TD-017 | Monolith deploy coupling | Cannot scale modules independently | Large | Acceptable until team > 5 engineers |
| TD-018 | Shopify sync is fire-and-forget | Failed syncs need manual retry | Medium | Retry queue + admin sync status UI |
| TD-019 | `warehouse_events` not org-scoped | Noise when multi-tenant | Small | Filter via order join or add org_id |
| TD-020 | Deprecated `CNY_TO_GBP_RATE` export | Confusion for new code | Trivial | Remove after all imports migrated |

---

## Resolved in Sprint 009

| ID | Item | Resolution |
|----|------|------------|
| TD-R01 | API handlers lacked `requireStaff()` | `staffRoute()` wrapper on all protected routes |
| TD-R02 | Org queries not filtered | `getOrganizationId()` passed to list/dashboard functions |
| TD-R03 | Triplicated admin navigation | `ModuleNav` component |
| TD-R04 | Triplicated packing slip download | `lib/client/download-packing-slip.ts` |
| TD-R05 | Duplicate `formatOrderPrice` | `lib/format.ts` single source |
| TD-R06 | Dead `lib/products.ts` | Deleted |
| TD-R07 | Unused `useInventory` / `useWarehouse` hooks | Deleted |
| TD-R08 | Hardcoded exchange rate in checkout UI | `getDisplayCnyToGbpRate()` from tenant config |
| TD-R09 | Per-route Supabase boilerplate | `staffRoute()` consolidates |

---

## Review cadence

- Update this register at the end of each sprint.
- P0 items must be zero before enabling a second production tenant.
- Link new ADRs when architectural decisions change debt status.
