import { NextResponse } from "next/server";
import { staffRoute } from "@/lib/thomas/api/staff-route";
import { getProductById } from "@/lib/inventory/products";
import { getProductBalances, getProductLedger } from "@/lib/inventory/movements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = staffRoute<{ id: string }>(async ({ request, supabase, params }) => {
  const { searchParams } = new URL(request.url);
  const include = searchParams.get("include") ?? "";

  const { product, error } = await getProductById(supabase, params.id);
  if (error || !product) {
    return NextResponse.json({ success: false, error: error ?? "Not found." }, { status: 404 });
  }

  const result: Record<string, unknown> = { product };

  if (include.includes("balances")) {
    const { balances } = await getProductBalances(supabase, params.id);
    result.balances = balances;
  }
  if (include.includes("ledger")) {
    const { ledger } = await getProductLedger(supabase, params.id);
    result.ledger = ledger;
  }

  return NextResponse.json({ success: true, ...result });
});
