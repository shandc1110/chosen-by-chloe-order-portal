import { NextResponse } from "next/server";
import { staffRoute } from "@/lib/thomas/api/staff-route";
import {
  startPacking,
  getPackSessionByOrder,
  verifyPackItem,
  markPackingSlipPrinted,
  markLabelPrinted,
  completePacking,
  dispatchOrder,
} from "@/lib/warehouse/packing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = staffRoute(async ({ request, supabase }) => {
  const orderId = new URL(request.url).searchParams.get("order_id");
  if (!orderId) {
    return NextResponse.json({ success: false, error: "order_id required." }, { status: 400 });
  }

  const { session } = await getPackSessionByOrder(supabase, orderId);
  return NextResponse.json({ success: true, session });
});

export const POST = staffRoute(async ({ request, supabase }) => {
  const body = await request.json();

  switch (body.action) {
    case "start": {
      const { session, error } = await startPacking(supabase, body.order_id, body.packed_by);
      if (error) return NextResponse.json({ success: false, error }, { status: 500 });
      return NextResponse.json({ success: true, session });
    }
    case "verify": {
      const result = await verifyPackItem(supabase, body.session_id, {
        sku_or_barcode: body.code,
        quantity: body.quantity,
      });
      return NextResponse.json({ success: result.match, ...result });
    }
    case "slip_printed": {
      await markPackingSlipPrinted(supabase, body.session_id);
      return NextResponse.json({ success: true });
    }
    case "label_printed": {
      await markLabelPrinted(supabase, body.session_id, body.order_id);
      return NextResponse.json({ success: true });
    }
    case "complete": {
      const { error } = await completePacking(supabase, body.session_id, body.packed_by);
      if (error) return NextResponse.json({ success: false, error }, { status: 400 });
      return NextResponse.json({ success: true });
    }
    case "dispatch": {
      const { error } = await dispatchOrder(supabase, body.order_id, body.tracking_number, body.user_name);
      if (error) return NextResponse.json({ success: false, error }, { status: 500 });
      return NextResponse.json({ success: true });
    }
    default:
      return NextResponse.json({ success: false, error: "Unknown action." }, { status: 400 });
  }
});
