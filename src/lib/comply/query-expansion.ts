/**
 * Query Expansion — uses a fast LLM (Haiku) to generate multiple specific
 * NCC search queries from a category name + project context.
 */

import { callModel } from "@/lib/ai/models";
import { extractJson } from "@/lib/ai/extract-json";

interface QueryExpansionResult {
  queries: string[];
}

/**
 * Expand a compliance category into 3-5 specific NCC search queries.
 * Uses the cheapest/fastest model for speed.
 */
export async function expandQuery(
  category: string,
  projectContext: string,
  options?: { orgId?: string; checkId?: string }
): Promise<string[]> {
  const categoryLabel = category.replace(/_/g, " ");

  try {
    const result = await callModel("rd_classification", {
      messages: [
        {
          role: "user",
          content: `You are an NCC (National Construction Code) search query specialist for Australian residential construction.

Given the compliance category "${categoryLabel}" and project context below, generate 3-5 specific NCC search queries that would retrieve the most relevant code provisions, standards references, and requirements.

PROJECT CONTEXT (abbreviated):
${projectContext.slice(0, 1500)}

Generate queries that:
- Reference specific NCC clause numbers where possible (e.g., "3.7.1", "H1P1")
- Include relevant Australian Standards numbers (e.g., "AS 3786", "AS 1684")
- Are specific to the building class and construction type
- Cover different aspects of the category

Respond with JSON:
{ "queries": ["query 1", "query 2", "query 3"] }

Return ONLY valid JSON.`,
        },
      ],
      maxTokens: 512,
      orgId: options?.orgId,
      checkId: options?.checkId,
    });

    const parsed = extractJson<QueryExpansionResult>(result.text);
    return parsed.queries.slice(0, 5);
  } catch (err) {
    console.warn(`[QueryExpansion] Failed for ${category}, using default query:`, err);
    // Fallback: return a single default query
    return [`NCC ${categoryLabel} requirements Australian residential`];
  }
}
