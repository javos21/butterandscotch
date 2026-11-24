import "server-only";
import sharp from "sharp";

/** Longest edge of a stored menu photo, in pixels. Big enough for the item page, small for phones. */
export const PHOTO_MAX_EDGE = 1600;

/**
 * Normalises an uploaded photo for the web: honours camera rotation, fits it within 1600px,
 * converts to sRGB and re-encodes as WebP. Throws if the bytes are not an image sharp can read.
 */
export async function resizePhoto(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize({ width: PHOTO_MAX_EDGE, height: PHOTO_MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .toColourspace("srgb")
    .webp({ quality: 80 })
    .toBuffer();
}
