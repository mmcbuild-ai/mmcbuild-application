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
 * Diagnostic variant: returns either the rendered image OR a surfaced error
 * with detail, plus PDF page-count when available. Use this when callers need
 * to know WHY rendering failed (e.g. the test harness). Production code can
 * stay on `renderPdfPage` which swallows errors to keep the happy path simple.
 */
export async function renderPdfPageDetailed(
  pdfBuffer: Uint8Array | Buffer,
  pageNumber: number = 1,
  scale: number = 2.0
): Promise<
  | { image: string; pageCount: number }
  | { error: string; pageCount?: number }
> {
  try {
    const { pdf } = await import("pdf-to-img");
    const doc = await pdf(pdfBuffer, { scale });
    const pageCount = doc.length;

    if (pageNumber < 1 || pageNumber > pageCount) {
      return {
        error: `Page ${pageNumber} out of range (PDF has ${pageCount} pages)`,
        pageCount,
      };
    }

    const image = await doc.getPage(pageNumber);
    return {
      image: Buffer.from(image).toString("base64"),
      pageCount,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("PDF to image rendering failed:", message, stack);
    return { error: message };
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
