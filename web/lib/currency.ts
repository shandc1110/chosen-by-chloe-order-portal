import { getActiveTenant } from "@/lib/thomas/tenant/resolve";

export type OrderCurrency = "CNY" | "GBP";

export function normaliseCurrency(value: string | null | undefined): OrderCurrency {
  return value?.trim().toUpperCase() === "GBP" ? "GBP" : "CNY";
}

function getCnyToGbpRate(): number {
  return getActiveTenant().commerce.cnyToGbpRate;
}

/** Tenant-configured CNY→GBP rate for display (e.g. checkout footer). */
export function getDisplayCnyToGbpRate(): number {
  return getCnyToGbpRate();
}

/** Convert a CNY amount to GBP using the tenant exchange rate. */
export function convertCnyToGbp(cnyAmount: number): number {
  const rate = getCnyToGbpRate();
  return Math.round((cnyAmount / rate) * 100) / 100;
}

/** Return the order price for the chosen currency (catalog prices are stored in CNY). */
export function priceForCurrency(cnyPrice: number, currency: string | null | undefined): number {
  const code = normaliseCurrency(currency);
  return code === "GBP" ? convertCnyToGbp(cnyPrice) : cnyPrice;
}

/** @deprecated Use getActiveTenant().commerce.cnyToGbpRate */
export const CNY_TO_GBP_RATE = 9.25;
