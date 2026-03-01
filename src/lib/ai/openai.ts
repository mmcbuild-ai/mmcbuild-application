import OpenAI from "openai";
import type { EmbeddingResult } from "./types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const EMBEDDING_MODEL = "text-embedding-3-small";
const BATCH_SIZE = 100;

export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
    dimensions: 1536,
  });

  return {
    embedding: response.data[0].embedding,
    tokens_used: response.usage.total_tokens,
  };
}

export async function generateEmbeddings(
  texts: string[]
): Promise<EmbeddingResult[]> {
  const results: EmbeddingResult[] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
      dimensions: 1536,
    });

    const tokensPerItem = Math.ceil(
      response.usage.total_tokens / batch.length
    );

    for (const item of response.data) {
      results.push({
        embedding: item.embedding,
        tokens_used: tokensPerItem,
      });
    }
  }

  return results;
}
