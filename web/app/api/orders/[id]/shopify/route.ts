import { NextResponse } from "next/server";
import { staffRoute } from "@/lib/thomas/api/staff-route";
import { getOrganizationId } from "@/lib/thomas/tenant/scope";
import { getOrderById, updateOrderFulfilment } from "@/lib/orders";
import { pushOrderToShopify } from "@/lib/shopify/createDraftOrder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = staffRoute<{ id: string }>(async ({ supabase, params }) => {
  const orgId = getOrganizationId();
  const { order, error } = await getOrderById(supabase, params.id, orgId);

  if (error || !order) {
    return NextResponse.json(
      { success: false, error: error ?? "Order not found." },
      { status: 404 },
    );
  }

  try {
    const result = await pushOrderToShopify(order);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 502 });
    }

    if (!result.alreadySynced || !order.shopify_draft_order_id) {
      const { error: updateError } = await updateOrderFulfilment(supabase, params.id, {
        shopify_draft_order_id: result.draftOrderId,
        fulfilment_status: "ready",
      });

      if (updateError) {
        console.error(
          `Shopify draft created (${result.draftOrderId}) but DB update failed for order ${params.id}:`,
          updateError,
        );
        return NextResponse.json({
          success: true,
          already_synced: result.alreadySynced,
          draft_order_id: result.draftOrderId,
          admin_url: result.adminUrl,
          warning: "Draft order created in Shopify but could not save sync status locally.",
        });
      }
    }

    return NextResponse.json({
      success: true,
      already_synced: result.alreadySynced,
      draft_order_id: result.draftOrderId,
      admin_url: result.adminUrl,
      message: result.alreadySynced
        ? "Already synced — no duplicate draft order created."
        : "Draft order created in Shopify.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Shopify sync failed.";
    console.error(`Shopify push failed for order ${params.id}:`, err);
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
});
