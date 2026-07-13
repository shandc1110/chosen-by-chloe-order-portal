import { NextResponse } from "next/server";
import { staffRoute } from "@/lib/thomas/api/staff-route";
import { getProductById } from "@/lib/inventory/products";
import { renderBarcodePng, ensureBarcode } from "@/lib/barcode/generate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = staffRoute<{ id: string }>(async ({ request, supabase, params }) => {
  const format = (new URL(request.url).searchParams.get("format") ?? "ean") as "ean" | "qr" | "code128";

  const { product, error } = await getProductById(supabase, params.id);
  if (error || !product) {
    return NextResponse.json({ success: false, error: "Product not found." }, { status: 404 });
  }

  try {
    const barcodeValue = ensureBarcode(product.sku ?? String(product.id), product.barcode);
    const png = await renderBarcodePng(barcodeValue, format);

    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Barcode generation failed:", err);
    return NextResponse.json({ success: false, error: "Barcode generation failed." }, { status: 500 });
  }
});
