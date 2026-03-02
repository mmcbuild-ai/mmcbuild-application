/**
 * Agent Tool: lookup_ncc_clause
 * Dynamic RAG retrieval for a specific NCC clause.
 */

import { retrieveContext } from "@/lib/comply/retriever";

export const lookupNccClauseDef = {
  name: "lookup_ncc_clause",
  description:
    "Look up a specific NCC (National Construction Code) clause or standard reference. " +
    "Returns the relevant code text from the knowledge base.",
  input_schema: {
    type: "object" as const,
    properties: {
      clause_number: {
        type: "string",
        description: "The NCC clause number (e.g., '3.7.1.1', 'H1P1') or AS standard (e.g., 'AS 3786')",
      },
      context_query: {
        type: "string",
        description: "Additional context for the search (e.g., 'fire separation residential garage')",
      },
    },
    required: ["clause_number"],
  },
};

export async function executeLookupNccClause(
  input: { clause_number: string; context_query?: string },
  context: { orgId: string }
): Promise<string> {
  const query = input.context_query
    ? `NCC ${input.clause_number} ${input.context_query}`
    : `NCC clause ${input.clause_number}`;

  const docs = await retrieveContext(query, {
    orgId: context.orgId,
    sourceType: "ncc_volume",
    matchThreshold: 0.4,
    matchCount: 3,
    includeSystem: true,
  });

  if (docs.length === 0) {
    return `No NCC reference material found for clause ${input.clause_number}. Use your knowledge of the NCC.`;
  }

  return docs
    .map((d, i) => `[Source ${i + 1}] (similarity: ${d.similarity.toFixed(2)})\n${d.content}`)
    .join("\n\n---\n\n");
}
