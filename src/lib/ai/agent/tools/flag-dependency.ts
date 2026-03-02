/**
 * Agent Tool: flag_cross_category_dependency
 * Marks a category as needing re-analysis due to cross-category dependency.
 */

export type CrossCategoryDependency = {
  source_category: string;
  target_category: string;
  description: string;
};

export const flagDependencyDef = {
  name: "flag_cross_category_dependency",
  description:
    "Flag that a finding in the current category has implications for another category " +
    "that may need re-analysis. For example, a structural bracing issue affecting fire separation.",
  input_schema: {
    type: "object" as const,
    properties: {
      source_category: {
        type: "string",
        description: "The current category where the dependency was discovered",
      },
      target_category: {
        type: "string",
        description: "The category that should be re-examined",
      },
      description: {
        type: "string",
        description: "Description of the cross-category dependency",
      },
    },
    required: ["source_category", "target_category", "description"],
  },
};

export function executeFlagDependency(
  input: CrossCategoryDependency,
  context: { dependencies: CrossCategoryDependency[] }
): string {
  context.dependencies.push(input);
  return `Flagged: ${input.source_category} → ${input.target_category}: ${input.description}`;
}
