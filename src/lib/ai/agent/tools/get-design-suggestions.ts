/**
 * Agent Tool: get_design_suggestions
 * Retrieves MMC design suggestions from a completed Build report for the same project.
 */

import { db } from "@/lib/supabase/db";

export const getDesignSuggestionsDef = {
  name: "get_design_suggestions",
  description:
    "Retrieve MMC design optimisation suggestions from a completed Build report. " +
    "Use this to find MMC alternatives and their estimated savings, so you can " +
    "provide accurate MMC cost comparisons.",
  input_schema: {
    type: "object" as const,
    properties: {
      category_filter: {
        type: "string",
        description: "Optional: filter by technology category (e.g., 'prefabricated_wall_panels', 'modular_pods')",
      },
    },
    required: [],
  },
};

export async function executeGetDesignSuggestions(
  input: { category_filter?: string },
  context: { projectId: string }
): Promise<string> {
  // Find the latest completed design check for this project
  const { data: check } = await db()
    .from("design_checks")
    .select("id")
    .eq("project_id", context.projectId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .single();

  if (!check) {
    return "No completed Build (design optimisation) report found for this project. Estimate MMC alternatives based on your market knowledge.";
  }

  let query = db()
    .from("design_suggestions")
    .select("technology_category, current_approach, suggested_alternative, benefits, estimated_time_savings, estimated_cost_savings, estimated_waste_reduction, implementation_complexity, confidence")
    .eq("check_id", (check as { id: string }).id)
    .order("sort_order");

  if (input.category_filter) {
    query = query.eq("technology_category", input.category_filter);
  }

  const { data: suggestions } = await query;

  if (!suggestions || suggestions.length === 0) {
    return input.category_filter
      ? `No design suggestions found for technology category "${input.category_filter}". Check other categories or estimate based on market knowledge.`
      : "No design suggestions found in the Build report.";
  }

  const lines = (suggestions as {
    technology_category: string;
    current_approach: string;
    suggested_alternative: string;
    estimated_cost_savings: number;
    estimated_time_savings: number;
    implementation_complexity: string;
    confidence: number;
  }[]).map(
    (s, i) =>
      `${i + 1}. [${s.technology_category}]\n` +
      `   Current: ${s.current_approach}\n` +
      `   MMC Alternative: ${s.suggested_alternative}\n` +
      `   Est. cost savings: ${s.estimated_cost_savings}%, time savings: ${s.estimated_time_savings}%\n` +
      `   Complexity: ${s.implementation_complexity}, Confidence: ${Math.round(s.confidence * 100)}%`
  );

  return `Design suggestions from Build report:\n\n${lines.join("\n\n")}`;
}
