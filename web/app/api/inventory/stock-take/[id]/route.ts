import { NextResponse } from "next/server";
import { staffRoute } from "@/lib/thomas/api/staff-route";
import { addStockTakeLine, approveStockTake } from "@/lib/inventory/stock-take";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = staffRoute<{ id: string }>(async ({ request, supabase, params }) => {
  const body = await request.json();

  if (body.action === "approve") {
    const { error } = await approveStockTake(supabase, params.id, body.approved_by);
    if (error) return NextResponse.json({ success: false, error }, { status: 500 });
    return NextResponse.json({ success: true, message: "Stock take approved." });
  }

  if (!body?.product_id || !body?.location_id || body.counted_quantity == null) {
    return NextResponse.json({ success: false, error: "Missing required fields." }, { status: 400 });
  }

  const { lineId, variance, error } = await addStockTakeLine(supabase, params.id, body);
  if (error) return NextResponse.json({ success: false, error }, { status: 500 });
  return NextResponse.json({ success: true, line_id: lineId, variance });
});
