import { chosenByChloeTenant } from "@/tenants/chosen-by-chloe/config";
import type { TenantConfig } from "./types";

const TENANTS: Record<string, TenantConfig> = {
  [chosenByChloeTenant.slug]: chosenByChloeTenant,
};

/** Resolve the active tenant. Single-tenant today; slug from env for future multi-tenant. */
export function getActiveTenant(): TenantConfig {
  const slug = process.env.THOMAS_TENANT_SLUG ?? chosenByChloeTenant.slug;
  const tenant = TENANTS[slug];
  if (!tenant) {
    throw new Error(`Unknown tenant slug: ${slug}`);
  }
  return tenant;
}

/** Client-safe tenant accessor (active tenant only in v0.1). */
export function getClientTenant(): TenantConfig {
  return chosenByChloeTenant;
}
