/**
 * Agent Tool: extract_quantities
 * Extracts element quantities from plan content for a specific cost category.
 */

import { retrievePlanChunks } from "@/lib/comply/retriever";

export const extractQuantitiesDef = {
  name: "extract_quantities",
  description:
    "Extract element quantities from the building plan for a specific cost category. " +
    "Use this when you need more detail about specific elements (e.g., wall lengths, floor areas, number of windows).",
  input_schema: {
    type: "object" as const,
    properties: {
      category: {
        type: "string",
        description: "The cost category to extract quantities for (e.g., 'frame', 'plumbing')",
      },
      specific_elements: {
        type: "string",
        description: "Specific elements to look for (e.g., 'number of bathroom fixtures', 'total wall length')",
      },
    },
    required: ["category"],
  },
};

export async function executeExtractQuantities(
  input: { category: string; specific_elements?: string },
  context: { orgId: string; planId: string }
): Promise<string> {
  const planContent = await retrievePlanChunks(context.orgId, context.planId);

  if (!planContent) {
    return "No plan content available. Use typical estimates for a standard Australian residential project.";
  }

  // Return relevant plan content for the agent to interpret
  const query = input.specific_elements
    ? `${input.category}: ${input.specific_elements}`
    : input.category;

  return `Plan content available for quantity extraction (category: ${query}):\n\n${planContent.slice(0, 4000)}\n\n[Analyse the above content to determine quantities for ${input.category} elements.]`;
}
