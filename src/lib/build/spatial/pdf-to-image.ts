/**
 * Piece 1: PDF → Image rendering
 *
 * Renders PDF pages to base64-encoded PNG images for vision AI extraction.
 * Server-side only (uses pdf-to-img which requires Node.js).
 */

import "server-only";

/**
 * Render the first page of a PDF to a base64-encoded PNG image.
 *
 * @param pdfBuffer - The raw PDF file as a Buffer/Uint8Array
 * @param pageNumber - Which page to render (1-indexed, default: 1)
 * @param scale - Resolution scale factor (default: 2.0 for good detail)
 * @returns Base64-encoded PNG string, or null on failure
 */
export async function renderPdfPage(
  pdfBuffer: Uint8Array | Buffer,
  pageNumber: number = 1,
  scale: number = 2.0
): Promise<string | null> {
  try {
    // Dynamic import to avoid issues with ESM/CJS in Next.js serverless
    const { pdf } = await import("pdf-to-img");
    const doc = await pdf(pdfBuffer, { scale });

    // Use getPage for direct page access
    const image = await doc.getPage(pageNumber);
    return Buffer.from(image).toString("base64");
  } catch (error) {
    console.error("PDF to image rendering failed:", error);
    return null;
  }
}

/**
 * Render all pages of a PDF to base64 PNG images.
 */
export async function renderAllPdfPages(
  pdfBuffer: Uint8Array | Buffer,
  scale: number = 2.0
): Promise<string[]> {
  const pages: string[] = [];

  try {
    const { pdf } = await import("pdf-to-img");
    const doc = await pdf(pdfBuffer, { scale });

    for (let i = 1; i <= doc.length; i++) {
      const image = await doc.getPage(i);
      pages.push(Buffer.from(image).toString("base64"));
    }
  } catch (error) {
    console.error("PDF to image rendering failed:", error);
  }

  return pages;
}
