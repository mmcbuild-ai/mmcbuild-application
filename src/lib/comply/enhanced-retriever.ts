/**
 * Enhanced Retriever — orchestrates multi-query RAG with reranking.
 *
 * Pipeline:
 *   expandQuery() → [3-5 queries]
 *     → for each: generateEmbedding() → match_documents_hybrid()
 *     → union + deduplicate by chunk ID
 *     → rerankDocuments(original_query, candidates)
 *     → return top K with rerank_score + chunk_ids
 */

import { expandQuery } from "./query-expansion";
import { retrieveContext } from "./retriever";
import { rerankDocuments } from "./reranker";
import type { RetrievedDocument } from "@/lib/ai/types";

export interface EnhancedRetrievalOptions {
  orgId: string;
  category: string;
  projectContext: string;
  sourceType?: string;
  matchThreshold?: number;
  matchCount?: number;
  includeSystem?: boolean;
  topK?: number;
  checkId?: string;
}

export interface EnhancedRetrievalResult {
  documents: RetrievedDocument[];
  chunkIds: string[];
  queryCount: number;
  candidateCount: number;
}

/**
 * Enhanced retrieval with query expansion + multi-query + reranking.
 */
export async function enhancedRetrieve(
  options: EnhancedRetrievalOptions
): Promise<EnhancedRetrievalResult> {
  const {
    orgId,
    category,
    projectContext,
    sourceType,
    matchThreshold = 0.5,
    matchCount = 8,
    includeSystem = true,
    topK = 8,
    checkId,
  } = options;

  const categoryLabel = category.replace(/_/g, " ");

  // Step 1: Expand query into multiple specific searches
  const queries = await expandQuery(category, projectContext, { orgId, checkId });

  console.log(
    `[EnhancedRetriever] ${category}: expanded to ${queries.length} queries`
  );

  // Step 2: Run all queries in parallel
  const allResults = await Promise.all(
    queries.map((query) =>
      retrieveContext(query, {
        orgId,
        sourceType,
        matchThreshold,
        matchCount,
        includeSystem,
      })
    )
  );

  // Step 3: Union + deduplicate by chunk ID
  const seen = new Set<string>();
  const candidates: RetrievedDocument[] = [];

  for (const results of allResults) {
    for (const doc of results) {
      if (!seen.has(doc.id)) {
        seen.add(doc.id);
        candidates.push(doc);
      }
    }
  }

  console.log(
    `[EnhancedRetriever] ${category}: ${candidates.length} unique candidates from ${queries.length} queries`
  );

  // Step 4: Rerank with cross-encoder
  const originalQuery = `NCC ${categoryLabel} requirements Australian residential construction`;
  const reranked = await rerankDocuments(originalQuery, candidates, topK, {
    orgId,
    checkId,
  });

  return {
    documents: reranked,
    chunkIds: reranked.map((d) => d.id),
    queryCount: queries.length,
    candidateCount: candidates.length,
  };
}
