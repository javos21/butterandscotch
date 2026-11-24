/** True when a stored receipt path is a PDF rather than an image. Plain module so server and client code can both use it. */
export function isPdfPath(path: string | null): boolean {
  return /\.pdf$/i.test(path ?? "");
}
