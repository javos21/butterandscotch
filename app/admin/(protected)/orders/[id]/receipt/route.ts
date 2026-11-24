import { loadReceiptData } from "@/lib/admin/payments-repo";
import { requireStaff } from "@/lib/auth/require-staff";
import { receiptFilename, renderReceiptPdf } from "@/lib/receipt/render-receipt";

export const dynamic = "force-dynamic";

/** The receipt PDF for staff. Requires a staff session, and is available once the payment is confirmed. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const data = await loadReceiptData({ orderId: id });
  if (!data) return new Response("Not found", { status: 404 });

  const pdf = await renderReceiptPdf(data);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${receiptFilename(data.orderNumber)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
