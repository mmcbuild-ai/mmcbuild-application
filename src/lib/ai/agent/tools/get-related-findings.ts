/**
 * Agent Tool: get_related_findings
 * Access findings from already-analyzed categories for cross-category awareness.
 */

import type { ComplianceSectionResult } from "@/lib/ai/types";

export const getRelatedFindingsDef = {
  name: "get_related_findings",
  description:
    "Get compliance findings from categories that have already been analyzed. " +
    "Use this to check for cross-category dependencies (e.g., structural bracing affecting fire safety).",
  input_schema: {
    type: "object" as const,
    properties: {
      categories: {
        type: "array",
        items: { type: "string" },
        description: "Category keys to retrieve findings from (e.g., ['structural', 'fire_safety'])",
      },
      severity_filter: {
        type: "string",
        enum: ["all", "non_compliant_and_critical", "critical_only"],
        description: "Filter findings by minimum severity level",
      },
    },
    required: ["categories"],
  },
};

export function executeGetRelatedFindings(
  input: { categories: string[]; severity_filter?: string },
  context: { priorResults: Map<string, ComplianceSectionResult> }
): string {
  const filter = input.severity_filter ?? "all";
  const results: string[] = [];

  for (const cat of input.categories) {
    const section = context.priorResults.get(cat);
    if (!section) {
      results.push(`[${cat}] Not yet analyzed.`);
      continue;
    }

    let findings = section.findings;
    if (filter === "critical_only") {
      findings = findings.filter((f) => f.severity === "critical");
    } else if (filter === "non_compliant_and_critical") {
      findings = findings.filter(
        (f) => f.severity === "non_compliant" || f.severity === "critical"
      );
    }

    if (findings.length === 0) {
      results.push(`[${cat}] No matching findings.`);
    } else {
      const lines = findings.map(
        (f) => `  - [${f.severity.toUpperCase()}] ${f.ncc_section}: ${f.title} — ${f.description.slice(0, 150)}`
      );
      results.push(`[${cat}] ${findings.length} findings:\n${lines.join("\n")}`);
    }
  }

  return results.join("\n\n");
}
