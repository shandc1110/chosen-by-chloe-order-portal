import type { SupabaseClient } from "@supabase/supabase-js";

const PREFIX = "CBC";
const START = 9001;

function parseOrderNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^CBC(\d+)$/i.exec(value.trim());
  if (!match) return null;
  const num = Number(match[1]);
  return Number.isFinite(num) ? num : null;
}

export function formatOrderNumber(num: number): string {
  return `${PREFIX}${num}`;
}

function isMissingOrderNumberColumn(error: { code?: string; message?: string }): boolean {
  if (error.code === "42703" || error.code === "PGRST204") return true;
  return Boolean(error.message?.toLowerCase().includes("order_number"));
}

/** Fallback when the column has not been migrated yet: CBC9001 + existing row count. */
async function allocateOrderNumberByCount(supabase: SupabaseClient): Promise<string> {
  const { count, error } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true });
  if (error) throw error;
  return formatOrderNumber(START + (count ?? 0));
}

/** Next reference after the highest existing CBC number (defaults to CBC9001). */
export async function allocateOrderNumber(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase
    .from("orders")
    .select("order_number")
    .not("order_number", "is", null)
    .order("order_number", { ascending: false })
    .limit(50);

  if (error && isMissingOrderNumberColumn(error)) {
    return allocateOrderNumberByCount(supabase);
  }
  if (error) throw error;

  let max = START - 1;
  for (const row of data ?? []) {
    const parsed = parseOrderNumber(row.order_number as string);
    if (parsed != null && parsed > max) max = parsed;
  }

  return formatOrderNumber(max + 1);
}

export function isOrderNumberConflict(error: { code?: string; message?: string }): boolean {
  if (error.code !== "23505") return false;
  const message = (error.message ?? "").toLowerCase();
  return message.includes("order_number");
}
