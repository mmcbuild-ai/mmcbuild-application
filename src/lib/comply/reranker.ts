/**
 * Cross-encoder reranking via HuggingFace Inference API.
 * Uses BAAI/bge-reranker-v2-m3 to rescore (query, passage) pairs.
 */

import { callModel } from "@/lib/ai/models";
import type { RetrievedDocument } from "@/lib/ai/types";

/**
 * Rerank retrieved documents using a cross-encoder model.
 * Returns documents sorted by rerank score, limited to topK.
 *
 * Graceful fallback: if HF API fails, returns original documents
 * sorted by cosine similarity.
 */
export async function rerankDocuments(
  query: string,
  documents: RetrievedDocument[],
  topK: number = 8,
  options?: { orgId?: string; checkId?: string }
): Promise<RetrievedDocument[]> {
  if (documents.length === 0) return [];
  if (documents.length <= topK) {
    // No reranking needed if we have fewer docs than topK
    return documents;
  }

  try {
    const result = await callModel("reranking", {
      query,
      documents: documents.map((d) => d.content),
      orgId: options?.orgId,
      checkId: options?.checkId,
    });

    if (!result.scores || result.scores.length !== documents.length) {
      console.warn("[Reranker] Score count mismatch, falling back to cosine ranking");
      return documents.slice(0, topK);
    }

    // Attach rerank scores and sort
    const scored = documents.map((doc, i) => ({
      ...doc,
      rerank_score: result.scores![i],
    }));

    scored.sort((a, b) => b.rerank_score - a.rerank_score);

    return scored.slice(0, topK);
  } catch (err) {
    console.warn("[Reranker] HF API failed, using cosine ranking:", err);
    // Graceful fallback: return by original similarity
    return [...documents]
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }
}
