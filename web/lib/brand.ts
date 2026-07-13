import { getClientTenant } from "@/lib/thomas/tenant/resolve";

/** @deprecated Use getClientTenant().brand or getActiveTenant().brand */
export const BRAND = getClientTenant().brand;
