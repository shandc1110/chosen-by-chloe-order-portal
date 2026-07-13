import { NextResponse } from "next/server";
import { staffRoute } from "@/lib/thomas/api/staff-route";
import { getOrganizationId } from "@/lib/thomas/tenant/scope";
import { getWarehouseDashboard, listWarehouseOrders } from "@/lib/warehouse/dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = staffRoute(async ({ supabase }) => {
  const orgId = getOrganizationId();
  const [{ stats, error }, { orders }] = await Promise.all([
    getWarehouseDashboard(supabase, orgId),
    listWarehouseOrders(supabase, undefined, orgId),
  ]);

  if (error || !stats) {
    return NextResponse.json({ success: false, error }, { status: 500 });
  }

  return NextResponse.json({ success: true, stats, orders });
});
