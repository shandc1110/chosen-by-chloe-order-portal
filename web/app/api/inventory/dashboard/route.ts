import { NextResponse } from "next/server";
import { staffRoute } from "@/lib/thomas/api/staff-route";
import { getOrganizationId } from "@/lib/thomas/tenant/scope";
import { getDashboardStats, generateAlerts } from "@/lib/inventory/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = staffRoute(async ({ supabase }) => {
  const orgId = getOrganizationId();
  const [{ stats, error }, { alerts }] = await Promise.all([
    getDashboardStats(supabase, orgId),
    generateAlerts(supabase, orgId),
  ]);

  if (error || !stats) {
    return NextResponse.json({ success: false, error: error ?? "Failed to load dashboard." }, { status: 500 });
  }

  return NextResponse.json({ success: true, stats, alerts });
});
