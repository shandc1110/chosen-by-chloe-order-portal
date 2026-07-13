import { NextResponse } from "next/server";
import { staffRoute } from "@/lib/thomas/api/staff-route";
import { getOrganizationId } from "@/lib/thomas/tenant/scope";
import { getOrderById } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = staffRoute<{ id: string }>(async ({ supabase, params }) => {
  const orgId = getOrganizationId();
  const { order, error } = await getOrderById(supabase, params.id, orgId);

  if (error || !order) {
    return NextResponse.json(
      { success: false, error: error ?? "Order not found." },
      { status: error?.includes("not found") ? 404 : 500 },
    );
  }

  return NextResponse.json({ success: true, order });
});
