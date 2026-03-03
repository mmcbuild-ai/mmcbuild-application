/**
 * Agent Tool: lookup_cost_rate
 * Looks up reference cost rates from the cost_reference_rates table.
 */

import { createAdminClient } from "@/lib/supabase/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db() { return createAdminClient() as unknown as any; }

export const lookupCostRateDef = {
  name: "lookup_cost_rate",
  description:
    "Look up reference cost rates from the Australian construction rates database. " +
    "Returns unit rates for specific elements within a cost category. " +
    "Use this before estimating costs to get accurate base rates.",
  input_schema: {
    type: "object" as const,
    properties: {
      category: {
        type: "string",
        description: "The cost category (e.g., 'frame', 'plumbing', 'external_walls')",
      },
      element: {
        type: "string",
        description: "Optional specific element to search for (e.g., 'timber wall frame')",
      },
      state: {
        type: "string",
        description: "Australian state for regional rates (default: 'NSW')",
      },
    },
    required: ["category"],
  },
};

export async function executeLookupCostRate(
  input: { category: string; element?: string; state?: string }
): Promise<string> {
  const state = input.state ?? "NSW";

  let query = db()
    .from("cost_reference_rates")
    .select("element, unit, base_rate, state, year, source")
    .eq("category", input.category);

  if (input.element) {
    query = query.ilike("element", `%${input.element}%`);
  }

  // Try exact state first, fall back to NSW
  const { data, error } = await query.eq("state", state).order("element");

  if (error) {
    return `Error looking up rates: ${error.message}`;
  }

  if (!data || data.length === 0) {
    // Fall back to NSW rates
    if (state !== "NSW") {
      const { data: nswData } = await db()
        .from("cost_reference_rates")
        .select("element, unit, base_rate, state, year, source")
        .eq("category", input.category)
        .eq("state", "NSW")
        .order("element");

      if (nswData && nswData.length > 0) {
        const lines = nswData.map(
          (r: { element: string; unit: string; base_rate: number; year: number }) =>
            `  - ${r.element}: $${r.base_rate}/${r.unit} (NSW ${r.year}, adjust for ${state})`
        );
        return `Reference rates for "${input.category}" (NSW base, needs ${state} adjustment):\n${lines.join("\n")}`;
      }
    }

    return `No reference rates found for category "${input.category}"${input.element ? ` element "${input.element}"` : ""}. Use your market knowledge to estimate.`;
  }

  const lines = (data as { element: string; unit: string; base_rate: number; state: string; year: number }[]).map(
    (r) => `  - ${r.element}: $${r.base_rate}/${r.unit} (${r.state} ${r.year})`
  );

  return `Reference rates for "${input.category}":\n${lines.join("\n")}`;
}
