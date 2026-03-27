/**
 * Agent Tool: lookup_cost_rate
 * Looks up reference cost rates from the cost_reference_rates table.
 * Returns source provenance information alongside rate data.
 * Gracefully falls back if migration 00019 (provenance columns) has not been applied.
 */

import { db } from "@/lib/supabase/db";

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

interface RateRowLegacy {
  element: string;
  unit: string;
  base_rate: number;
  state: string;
  year: number;
}

interface RateRowEnhanced extends RateRowLegacy {
  source_detail: string | null;
  effective_date: string | null;
  expires_at: string | null;
  cost_rate_sources: { name: string } | null;
}

type RateRow = RateRowLegacy | RateRowEnhanced;

function hasProvenance(row: RateRow): row is RateRowEnhanced {
  return "cost_rate_sources" in row;
}

function formatRateLine(r: RateRow, suffix?: string): string {
  const base = `  - ${r.element}: $${r.base_rate}/${r.unit} (${r.state} ${r.year}${suffix ?? ""})`;
  if (hasProvenance(r)) {
    const sourceName = r.cost_rate_sources?.name ?? "Unknown";
    const detail = r.source_detail ? ` [${r.source_detail}]` : "";
    return `${base} | source_name: "${sourceName}"${detail}`;
  }
  return `${base} | source_name: "MMC Build Seed Data (NSW 2025)"`;
}

/**
 * Try the enhanced query first (with provenance columns from migration 00019).
 * If it fails, fall back to the legacy query (original columns only).
 */
async function queryRates(
  category: string,
  state: string,
  element?: string
): Promise<{ data: RateRow[] | null; error: { message: string } | null }> {
  const today = new Date().toISOString().split("T")[0];

  // Try enhanced query first
  let query = db()
    .from("cost_reference_rates")
    .select("element, unit, base_rate, state, year, source_detail, effective_date, expires_at, cost_rate_sources(name)")
    .eq("category", category);

  if (element) {
    query = query.ilike("element", `%${element}%`);
  }

  query = query
    .or(`expires_at.is.null,expires_at.gte.${today}`)
    .eq("state", state)
    .order("effective_date", { ascending: false });

  const enhanced = await query;

  if (!enhanced.error) {
    return enhanced;
  }

  // Fall back to legacy query (no provenance columns)
  let legacyQuery = db()
    .from("cost_reference_rates")
    .select("element, unit, base_rate, state, year")
    .eq("category", category);

  if (element) {
    legacyQuery = legacyQuery.ilike("element", `%${element}%`);
  }

  legacyQuery = legacyQuery.eq("state", state).order("element");

  return legacyQuery;
}

export async function executeLookupCostRate(
  input: { category: string; element?: string; state?: string }
): Promise<string> {
  const state = input.state ?? "NSW";

  const { data, error } = await queryRates(input.category, state, input.element);

  if (error) {
    return `Error looking up rates: ${error.message}`;
  }

  if (!data || data.length === 0) {
    // Fall back to NSW rates
    if (state !== "NSW") {
      const { data: nswData } = await queryRates(input.category, "NSW", input.element);

      if (nswData && nswData.length > 0) {
        const lines = nswData.map((r) =>
          formatRateLine(r, `, adjust for ${state}`)
        );
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

  // Deduplicate by element (keep first occurrence — most recent effective_date if enhanced)
  const seen = new Set<string>();
  const dedupedData: RateRow[] = [];
  for (const r of data) {
    if (!seen.has(r.element)) {
      seen.add(r.element);
      dedupedData.push(r);
    }
  }

  const lines = dedupedData.map((r) => formatRateLine(r));

  return `Reference rates for "${input.category}":\n${lines.join("\n")}\n\nIMPORTANT: For each line item that uses a reference rate, set rate_source_name to the source_name shown above. If you estimate a rate yourself, set rate_source_name to "AI Estimated".`;
}
