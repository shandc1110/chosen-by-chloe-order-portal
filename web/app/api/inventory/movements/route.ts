import { NextResponse } from "next/server";
import { staffRoute } from "@/lib/thomas/api/staff-route";
import { listMovements } from "@/lib/inventory/movements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = staffRoute(async ({ request, supabase }) => {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("product_id") ?? undefined;
  const limit = Number(searchParams.get("limit") ?? 50);

  const { movements, error } = await listMovements(supabase, {
    productId: productId ?? undefined,
    limit,
  });

  if (error) return NextResponse.json({ success: false, error }, { status: 500 });
  return NextResponse.json({ success: true, movements });
});
