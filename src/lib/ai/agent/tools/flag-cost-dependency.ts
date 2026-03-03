/**
 * Agent Tool: flag_cost_dependency
 * Marks a cost category as needing adjustment due to cross-category dependency.
 */

export type CostDependency = {
  source_category: string;
  target_category: string;
  description: string;
  cost_impact_estimate: number | null;
};

export const flagCostDependencyDef = {
  name: "flag_cost_dependency",
  description:
    "Flag that a cost decision in the current category has implications for another category. " +
    "For example, choosing SIP panels for frame affects electrical rough-in costs. " +
    "The target category may be re-estimated with this context.",
  input_schema: {
    type: "object" as const,
    properties: {
      source_category: {
        type: "string",
        description: "The current cost category",
      },
      target_category: {
        type: "string",
        description: "The category that may need cost adjustment",
      },
      description: {
        type: "string",
        description: "Description of the cost dependency and impact",
      },
      cost_impact_estimate: {
        type: "number",
        description: "Estimated cost impact in AUD (positive = increase, negative = decrease)",
      },
    },
    required: ["source_category", "target_category", "description"],
  },
};

export function executeFlagCostDependency(
  input: CostDependency,
  context: { dependencies: CostDependency[] }
): string {
  context.dependencies.push(input);
  const impact = input.cost_impact_estimate
    ? ` (estimated impact: ${input.cost_impact_estimate > 0 ? "+" : ""}$${input.cost_impact_estimate.toLocaleString()})`
    : "";
  return `Flagged cost dependency: ${input.source_category} → ${input.target_category}: ${input.description}${impact}`;
}
