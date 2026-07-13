import { NextResponse } from "next/server";
import { staffRoute } from "@/lib/thomas/api/staff-route";
import { getProductByBarcode } from "@/lib/inventory/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = staffRoute(async ({ request, supabase }) => {
  const code = new URL(request.url).searchParams.get("code")?.trim();
  if (!code) return NextResponse.json({ success: false, error: "Barcode required." }, { status: 400 });

  const { product, error } = await getProductByBarcode(supabase, code);
  if (error || !product) {
    return NextResponse.json({ success: false, error: "Product not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true, product });
});
