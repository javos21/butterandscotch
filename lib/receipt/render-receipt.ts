import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import type { ReceiptData } from "@/lib/receipt/receipt-data";
import { ReceiptDocument } from "@/lib/receipt/ReceiptDocument";

export { receiptFilename } from "@/lib/receipt/receipt-data";

export const LOGO_PATH = path.join(process.cwd(), "public/brand/logo-red.png");

/**
 * Renders the receipt as a PDF. If the logo cannot be read, the receipt is rendered without it
 * and a warning is logged; a missing logo never blocks a receipt.
 */
export async function renderReceiptPdf(data: ReceiptData, logoPath: string = LOGO_PATH): Promise<Buffer> {
  let logo: Buffer | null = null;
  try {
    // The logo is bundled by outputFileTracingIncludes in next.config.ts, so the tracer need not follow this path.
    logo = await readFile(/* turbopackIgnore: true */ logoPath);
  } catch (err) {
    console.warn("[receipt] logo unreadable, rendering without it", logoPath, err);
  }
  // ReceiptDocument is a pure component, so calling it returns the <Document> element that
  // renderToBuffer needs as its root.
  return renderToBuffer(ReceiptDocument({ data, logo }));
}
