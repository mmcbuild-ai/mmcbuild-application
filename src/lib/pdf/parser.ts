export interface ParsedPdf {
  text: string;
  pageCount: number;
  metadata: Record<string, unknown>;
}

export async function parsePdf(buffer: Buffer): Promise<ParsedPdf> {
  // pdf-parse v1 is pure JS — works on Vercel serverless without native binaries
  const pdfParse = (await import("pdf-parse")).default;
  const result = await pdfParse(buffer);

  return {
    text: result.text,
    pageCount: result.numpages,
    metadata: {
      title: result.info?.Title ?? null,
      author: result.info?.Author ?? null,
      creator: result.info?.Creator ?? null,
    },
  };
}
