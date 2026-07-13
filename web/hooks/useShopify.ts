"use client";

import { useCallback, useState } from "react";
import { downloadPackingSlip as downloadPackingSlipFile } from "@/lib/client/download-packing-slip";

export type ShopifyPushState = {
  loading: boolean;
  error: string | null;
  success: string | null;
  synced: boolean;
  adminUrl: string | null;
};

export function useShopify(orderId: string, initialSynced: boolean, initialAdminUrl: string | null) {
  const [state, setState] = useState<ShopifyPushState>({
    loading: false,
    error: null,
    success: null,
    synced: initialSynced,
    adminUrl: initialAdminUrl,
  });

  const pushToShopify = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null, success: null }));

    try {
      const response = await fetch(`/api/orders/${orderId}/shopify`, { method: "POST" });
      const result = (await response.json()) as {
        success: boolean;
        error?: string;
        message?: string;
        already_synced?: boolean;
        admin_url?: string;
      };

      if (!response.ok || !result.success) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: result.error ?? "Could not push order to Shopify.",
        }));
        return;
      }

      setState((prev) => ({
        loading: false,
        error: null,
        success: result.message ?? "Order synced to Shopify.",
        synced: true,
        adminUrl: result.admin_url ?? prev.adminUrl,
      }));
    } catch {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: "Network error. Please try again.",
      }));
    }
  }, [orderId]);

  return { ...state, pushToShopify };
}

export function usePackingSlipDownload(orderId: string, orderNumber: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const downloadPackingSlip = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { error: downloadError } = await downloadPackingSlipFile(orderId, orderNumber);
    if (downloadError) setError(downloadError);

    setLoading(false);
  }, [orderId, orderNumber]);

  return { loading, error, downloadPackingSlip };
}
