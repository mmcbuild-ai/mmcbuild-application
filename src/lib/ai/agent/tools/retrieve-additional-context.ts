/**
 * Agent Tool: retrieve_additional_context
 * Lets the agent reformulate a RAG query for better retrieval.
 */

import { retrieveContext } from "@/lib/comply/retriever";

export const retrieveAdditionalContextDef = {
  name: "retrieve_additional_context",
  description:
    "Retrieve additional NCC reference material, plan content, or certification data " +
    "using a custom search query. Use when the initial context is insufficient.",
  input_schema: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description: "The search query to find relevant documents",
      },
      source_type: {
        type: "string",
        enum: ["ncc_volume", "plan", "certification"],
        description: "Type of source to search (default: all)",
      },
      max_results: {
        type: "number",
        description: "Maximum number of results to return (default: 5)",
      },
    },
    required: ["query"],
  },
};

export async function executeRetrieveAdditionalContext(
  input: { query: string; source_type?: string; max_results?: number },
  context: { orgId: string }
): Promise<string> {
  const docs = await retrieveContext(input.query, {
    orgId: context.orgId,
    sourceType: input.source_type,
    matchThreshold: 0.4,
    matchCount: input.max_results ?? 5,
    includeSystem: true,
  });

  if (docs.length === 0) {
    return `No documents found matching: "${input.query}"`;
  }

  return docs
    .map(
      (d, i) =>
        `[Result ${i + 1}] (${d.source_type}, similarity: ${d.similarity.toFixed(2)})\n${d.content}`
    )
    .join("\n\n---\n\n");
}
