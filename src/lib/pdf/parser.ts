import { PDFParse } from "pdf-parse";

export interface ParsedPdf {
  text: string;
  pageCount: number;
  metadata: Record<string, unknown>;
}

export async function parsePdf(buffer: Buffer): Promise<ParsedPdf> {
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
