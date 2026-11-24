import { requireStaff } from "@/lib/auth/require-staff";
import { loadReceiptData } from "@/lib/receipt/load-receipt";
import { receiptFilename, renderReceiptPdf } from "@/lib/receipt/render-receipt";
import { isUuid } from "@/lib/uuid";

export const dynamic = "force-dynamic";

/** The receipt PDF for staff. Requires a staff session, and is available once the payment is confirmed. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  if (!isUuid(id)) return new Response("Not found", { status: 404 });
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
