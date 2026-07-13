import { NextResponse } from "next/server";
import { staffRoute } from "@/lib/thomas/api/staff-route";
import { getOrganizationId } from "@/lib/thomas/tenant/scope";
import { listProducts, upsertProduct } from "@/lib/inventory/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = staffRoute(async ({ request, supabase }) => {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? undefined;
  const orgId = getOrganizationId();

  const { products, error } = await listProducts(supabase, { search, organizationId: orgId });
  if (error) return NextResponse.json({ success: false, error }, { status: 500 });
  return NextResponse.json({ success: true, products });
});

export const POST = staffRoute(async ({ request, supabase }) => {
  const body = await request.json();
  if (!body?.sku || !body?.name) {
    return NextResponse.json({ success: false, error: "SKU and name are required." }, { status: 400 });
  }

  const orgId = getOrganizationId();
  const { product, error } = await upsertProduct(supabase, {
    ...body,
    organization_id: orgId,
  });
  if (error) return NextResponse.json({ success: false, error }, { status: 500 });
  return NextResponse.json({ success: true, product });
});
