export interface ParsedPdf {
  text: string;
  pageCount: number;
  metadata: Record<string, unknown>;
}

export async function parsePdf(buffer: Buffer): Promise<ParsedPdf> {
  // Dynamic import to avoid loading @napi-rs/canvas at module registration time.
  // pdf-parse v2 bundles native binaries that crash Vercel's serverless runtime
  // if loaded eagerly (e.g. when the Inngest route registers all functions).
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const text = await parser.getText();
  const info = await parser.getInfo();

  return {
    text: text.pages.map((p) => p.text).join("\n\n"),
    pageCount: text.pages.length,
    metadata: {
      title: info.info?.Title ?? null,
      author: info.info?.Author ?? null,
      creator: info.info?.Creator ?? null,
    },
  };
}
