import type { DocumentChunk } from "../ai/types";

const DEFAULT_CHUNK_SIZE = 500; // approximate tokens
const DEFAULT_OVERLAP = 50;
const CHARS_PER_TOKEN = 4; // rough approximation

export interface ChunkOptions {
  chunkSize?: number;
  overlap?: number;
  sourceType?: string;
  sourceId?: string;
}

export function chunkText(
  text: string,
  options: ChunkOptions = {}
): DocumentChunk[] {
  const {
    chunkSize = DEFAULT_CHUNK_SIZE,
    overlap = DEFAULT_OVERLAP,
    sourceType = "plan",
    sourceId = "",
  } = options;

  const maxChars = chunkSize * CHARS_PER_TOKEN;
  const overlapChars = overlap * CHARS_PER_TOKEN;

  // Split into paragraphs first
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

  const chunks: DocumentChunk[] = [];
  let currentChunk = "";
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();

    // If adding this paragraph would exceed chunk size, save current and start new
    if (currentChunk.length + trimmed.length > maxChars && currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        metadata: { source_type: sourceType, source_id: sourceId },
        chunk_index: chunkIndex,
      });
      chunkIndex++;

      // Keep overlap from the end of the current chunk
      if (overlapChars > 0 && currentChunk.length > overlapChars) {
        currentChunk = currentChunk.slice(-overlapChars) + "\n\n" + trimmed;
      } else {
        currentChunk = trimmed;
      }
    } else {
      currentChunk = currentChunk
        ? currentChunk + "\n\n" + trimmed
        : trimmed;
    }
  }

  // Don't forget the last chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      content: currentChunk.trim(),
      metadata: { source_type: sourceType, source_id: sourceId },
      chunk_index: chunkIndex,
    });
  }

  return chunks;
}
