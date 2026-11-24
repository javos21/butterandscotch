import { loadReceiptData } from "@/lib/admin/payments-repo";
import { receiptFilename, renderReceiptPdf } from "@/lib/receipt/render-receipt";

export const dynamic = "force-dynamic";

/** The customer's receipt PDF. Available only once the payment is confirmed; otherwise 404. */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await loadReceiptData({ token });
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
