import { NextResponse } from "next/server";
import { staffRoute } from "@/lib/thomas/api/staff-route";
import { getOrganizationId } from "@/lib/thomas/tenant/scope";
import { listWarehouses, createWarehouse, createLocation } from "@/lib/warehouse/warehouses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = staffRoute(async ({ supabase }) => {
  const orgId = getOrganizationId();
  const { warehouses, error } = await listWarehouses(supabase, orgId);
  if (error) return NextResponse.json({ success: false, error }, { status: 500 });
  return NextResponse.json({ success: true, warehouses });
});

export const POST = staffRoute(async ({ request, supabase }) => {
  const body = await request.json();
  const orgId = getOrganizationId();

  if (body.type === "location") {
    const { location, error } = await createLocation(supabase, body);
    if (error) return NextResponse.json({ success: false, error }, { status: 500 });
    return NextResponse.json({ success: true, location });
  }

  const { warehouse, error } = await createWarehouse(supabase, { ...body, organization_id: orgId });
  if (error) return NextResponse.json({ success: false, error }, { status: 500 });
  return NextResponse.json({ success: true, warehouse });
});
