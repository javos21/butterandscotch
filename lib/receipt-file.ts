/**
 * Receipt size rules shared by the upload form and the server action. Vercel caps request bodies
 * at about 4.5 MB, so receipts are capped at 4 MB end to end.
 */
export const RECEIPT_MAX_BYTES = 4 * 1024 * 1024;

/** Photos above this size are shrunk in the browser before upload, so most phone shots fit. */
export const COMPRESS_ABOVE_BYTES = 3.5 * 1024 * 1024;

/** Longest edge, in pixels, of a compressed photo. */
const COMPRESS_MAX_EDGE = 2400;
const COMPRESS_QUALITY = 0.85;
const COMPRESSIBLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const TOO_LARGE_ERROR =
  "That file is too large — please upload a screenshot or a smaller photo (max 4 MB)";

export type ReceiptPlan =
  | { action: "send" }
  | { action: "compress" }
  | { action: "too_large" }
  | { action: "empty" };

/**
 * Decides what to do with a file before upload. Images over 3.5 MB are compressed first, and the
 * result is checked against the limit after. HEIC and PDF files cannot be shrunk here, so anything
 * over 4 MB is refused.
 */
export function planReceipt(file: { type: string; size: number }): ReceiptPlan {
  if (file.size === 0) return { action: "empty" };
  if (COMPRESSIBLE_TYPES.has(file.type) && file.size > COMPRESS_ABOVE_BYTES) {
    return { action: "compress" };
  }
  if (file.size > RECEIPT_MAX_BYTES) return { action: "too_large" };
  return { action: "send" };
}

/**
 * Shrinks a photo to at most 2400 px on its longest edge and re-encodes it as JPEG at quality 0.85.
 * The result is named .jpg. Runs only in the browser, and is not covered by unit tests.
 */
export async function compressReceipt(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, COMPRESS_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is not available");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error("Could not encode the photo"))),
        "image/jpeg",
        COMPRESS_QUALITY,
      ),
    );
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}
