/**
 * Agent Tool: lookup_cost_rate
 * Looks up reference cost rates from the cost_reference_rates table.
 * Returns source provenance information alongside rate data.
 */

import { createAdminClient } from "@/lib/supabase/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db() { return createAdminClient() as unknown as any; }

export const lookupCostRateDef = {
  name: "lookup_cost_rate",
  description:
    "Look up reference cost rates from the Australian construction rates database. " +
    "Returns unit rates for specific elements within a cost category, including the source name and detail. " +
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

interface RateRow {
  element: string;
  unit: string;
  base_rate: number;
  state: string;
  year: number;
  source_detail: string | null;
  effective_date: string | null;
  expires_at: string | null;
  cost_rate_sources: { name: string } | null;
}

export async function executeLookupCostRate(
  input: { category: string; element?: string; state?: string }
): Promise<string> {
  const state = input.state ?? "NSW";
  const today = new Date().toISOString().split("T")[0];

  let query = db()
    .from("cost_reference_rates")
    .select("element, unit, base_rate, state, year, source_detail, effective_date, expires_at, cost_rate_sources(name)")
    .eq("category", input.category);

  if (input.element) {
    query = query.ilike("element", `%${input.element}%`);
  }

  // Prefer non-expired rates
  query = query.or(`expires_at.is.null,expires_at.gte.${today}`);

  // Try exact state first, fall back to NSW
  const { data, error } = await query.eq("state", state).order("effective_date", { ascending: false });

  if (error) {
    return `Error looking up rates: ${error.message}`;
  }

  if (!data || data.length === 0) {
    // Fall back to NSW rates
    if (state !== "NSW") {
      const { data: nswData } = await db()
        .from("cost_reference_rates")
        .select("element, unit, base_rate, state, year, source_detail, effective_date, expires_at, cost_rate_sources(name)")
        .eq("category", input.category)
        .eq("state", "NSW")
        .or(`expires_at.is.null,expires_at.gte.${today}`)
        .order("effective_date", { ascending: false });

      if (nswData && nswData.length > 0) {
        const lines = (nswData as RateRow[]).map((r) => {
          const sourceName = r.cost_rate_sources?.name ?? "Unknown";
          const detail = r.source_detail ? ` [${r.source_detail}]` : "";
          return `  - ${r.element}: $${r.base_rate}/${r.unit} (NSW ${r.year}, adjust for ${state}) | source_name: "${sourceName}"${detail}`;
        });
        return `Reference rates for "${input.category}" (NSW base, needs ${state} adjustment):\n${lines.join("\n")}`;
      }
    }

    return JSON.stringify({
      rates: [],
      source_name: "AI Estimated",
      source_detail: null,
      message: `No reference rates found for category "${input.category}"${input.element ? ` element "${input.element}"` : ""}. Use your market knowledge to estimate.`,
    });
  }

  // Deduplicate by element (keep most recent effective_date per element)
  const seen = new Set<string>();
  const dedupedData: RateRow[] = [];
  for (const r of data as RateRow[]) {
    if (!seen.has(r.element)) {
      seen.add(r.element);
      dedupedData.push(r);
    }
  }

  const lines = dedupedData.map((r) => {
    const sourceName = r.cost_rate_sources?.name ?? "Unknown";
    const detail = r.source_detail ? ` [${r.source_detail}]` : "";
    return `  - ${r.element}: $${r.base_rate}/${r.unit} (${r.state} ${r.year}) | source_name: "${sourceName}"${detail}`;
  });

  return `Reference rates for "${input.category}":\n${lines.join("\n")}\n\nIMPORTANT: For each line item that uses a reference rate, set rate_source_name to the source_name shown above. If you estimate a rate yourself, set rate_source_name to "AI Estimated".`;
}
