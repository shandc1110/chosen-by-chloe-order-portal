/** Client-side packing slip PDF download (shared by orders + warehouse UI). */
export async function downloadPackingSlip(
  orderId: string | number,
  orderNumber: string,
): Promise<{ error: string | null }> {
  try {
    const response = await fetch(`/api/orders/${orderId}/packing-slip`);
    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      return { error: result.error ?? "Could not download packing slip." };
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `packing-slip-${orderNumber}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    return { error: null };
  } catch {
    return { error: "Network error. Please try again." };
  }
}
