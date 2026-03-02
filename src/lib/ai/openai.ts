import { callModel } from "./models";
import type { EmbeddingResult } from "./types";

const BATCH_SIZE = 100;

export async function generateEmbedding(
  text: string,
  options?: { orgId?: string; checkId?: string }
): Promise<EmbeddingResult> {
  const result = await callModel("embedding", {
    input: text,
    dimensions: 1536,
    orgId: options?.orgId,
    checkId: options?.checkId,
  });

  return {
    embedding: result.embeddings?.[0] ?? [],
    tokens_used: result.usage.inputTokens,
  };
}

export async function generateEmbeddings(
  texts: string[],
  options?: { orgId?: string; checkId?: string }
): Promise<EmbeddingResult[]> {
  const results: EmbeddingResult[] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const result = await callModel("embedding", {
      input: batch,
      dimensions: 1536,
      orgId: options?.orgId,
      checkId: options?.checkId,
    });

    const tokensPerItem = Math.ceil(
      result.usage.inputTokens / batch.length
    );

    const embeddings = result.embeddings ?? [];
    for (const emb of embeddings) {
      results.push({
        embedding: emb,
        tokens_used: tokensPerItem,
      });
    }
  }

  return results;
}
