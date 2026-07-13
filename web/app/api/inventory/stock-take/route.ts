import { NextResponse } from "next/server";
import { staffRoute } from "@/lib/thomas/api/staff-route";
import { startStockTake, getStockTakeSession } from "@/lib/inventory/stock-take";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = staffRoute(async ({ request, supabase }) => {
  const sessionId = new URL(request.url).searchParams.get("session");

  if (sessionId) {
    const { session, error } = await getStockTakeSession(supabase, sessionId);
    if (error) return NextResponse.json({ success: false, error }, { status: 404 });
    return NextResponse.json({ success: true, session });
  }

  const { data, error } = await supabase
    .from("stock_take_sessions")
    .select("*, warehouses ( code, name )")
    .order("started_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, sessions: data });
});

export const POST = staffRoute(async ({ request, supabase }) => {
  const body = await request.json();

  if (!body?.warehouse_id) {
    return NextResponse.json({ success: false, error: "warehouse_id required." }, { status: 400 });
  }

  const { session, error } = await startStockTake(supabase, body.warehouse_id, body.started_by);
  if (error) return NextResponse.json({ success: false, error }, { status: 500 });
  return NextResponse.json({ success: true, session });
});
