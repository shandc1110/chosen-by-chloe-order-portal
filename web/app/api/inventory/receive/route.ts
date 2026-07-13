import { NextResponse } from "next/server";
import { staffRoute } from "@/lib/thomas/api/staff-route";
import { receiveGoods } from "@/lib/inventory/receive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = staffRoute(async ({ request, supabase }) => {
  const body = await request.json();
  if (!body?.warehouse_id || !body?.location_id || !body?.lines?.length) {
    return NextResponse.json(
      { success: false, error: "warehouse_id, location_id, and lines are required." },
      { status: 400 },
    );
  }

  const { receipt, error } = await receiveGoods(supabase, body);
  if (error) return NextResponse.json({ success: false, error }, { status: 500 });
  return NextResponse.json({ success: true, receipt });
});
