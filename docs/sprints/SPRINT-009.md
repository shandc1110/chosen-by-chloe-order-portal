# Sprint 009 — Architecture Hardening

**Goal:** Make Thomas OS production-grade before Warehouse/Treasury/CRM feature expansion.  
**No new business features.**

## Deliverables

- [x] `docs/reviews/ARCHITECTURE_REVIEW_V1.md`
- [x] `docs/reviews/TECHNICAL_DEBT.md`
- [x] `docs/reviews/REFACTOR_SUMMARY.md`
- [x] Updated architecture, roadmap, schema, README

## Code Changes

### Platform
- `lib/thomas/api/staff-route.ts` — API handler wrapper
- `lib/thomas/tenant/scope.ts` — `getOrganizationId()`

### Security
- All 19 protected API routes use `staffRoute()` + `requireStaff()`
- Org-scoped list/dashboard queries

### Shared services
- `components/thomas/ModuleNav.tsx`
- `lib/client/download-packing-slip.ts`
- `formatOrderPrice` deduplicated in `lib/format.ts`

### Cleanup
- Removed `lib/products.ts`, `hooks/useInventory.ts`, `hooks/useWarehouse.ts`
- Checkout uses tenant exchange rate via `getDisplayCnyToGbpRate()`

## Decisions

| Topic | Decision |
|-------|----------|
| Repository pattern | Not introduced — `lib/*` is the service layer |
| Domain events | Deferred — existing ledgers suffice |
| RLS | Deferred to Sprint 010 |
| staff_profiles | Deferred to Sprint 010 |

## Verification

```bash
cd web && npm run build
```

## Next Sprint

Sprint 010 — RLS, staff profile validation, pagination, `inbound_shipments.organization_id`.
