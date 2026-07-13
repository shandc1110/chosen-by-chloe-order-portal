import { NextResponse } from "next/server";
import { staffRoute } from "@/lib/thomas/api/staff-route";
import {
  generatePickList,
  getPickListByOrder,
  startPicking,
  confirmPickLine,
  completePicking,
} from "@/lib/warehouse/picking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = staffRoute(async ({ request, supabase }) => {
  const orderId = new URL(request.url).searchParams.get("order_id");
  if (!orderId) {
    return NextResponse.json({ success: false, error: "order_id required." }, { status: 400 });
  }

  const { pickList, error } = await getPickListByOrder(supabase, orderId);
  return NextResponse.json({ success: true, pick_list: pickList, error });
});

export const POST = staffRoute(async ({ request, supabase }) => {
  const body = await request.json();

  if (body.action === "generate") {
    const { pickList, error } = await generatePickList(supabase, body.order_id);
    if (error) return NextResponse.json({ success: false, error }, { status: 500 });
    return NextResponse.json({ success: true, pick_list: pickList });
  }

  if (body.action === "start") {
    const { error } = await startPicking(supabase, body.pick_list_id, body.picked_by);
    if (error) return NextResponse.json({ success: false, error }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (body.action === "confirm_line") {
    const { error } = await confirmPickLine(supabase, body.line_id, body);
    if (error) return NextResponse.json({ success: false, error }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (body.action === "complete") {
    const { error } = await completePicking(supabase, body.pick_list_id, body.picked_by);
    if (error) return NextResponse.json({ success: false, error }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false, error: "Unknown action." }, { status: 400 });
});
