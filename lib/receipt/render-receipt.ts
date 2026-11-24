import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import type { ReceiptData } from "@/lib/receipt/receipt-data";
import { ReceiptDocument } from "@/lib/receipt/ReceiptDocument";

export { receiptFilename } from "@/lib/receipt/receipt-data";

const LOGO_PATH = path.join(process.cwd(), "public/brand/logo-red.png");

/** Renders the receipt as a PDF. Throws if the logo is missing or the layout fails. */
export async function renderReceiptPdf(data: ReceiptData): Promise<Buffer> {
  const logo = await readFile(LOGO_PATH);
  // ReceiptDocument is a pure component, so calling it returns the <Document> element that
  // renderToBuffer needs as its root.
  return renderToBuffer(ReceiptDocument({ data, logo }));
}
