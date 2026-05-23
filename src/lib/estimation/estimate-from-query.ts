/**
 * MMC Direct instant-estimate primitive (Phase 1, SCRUM-220).
 *
 * Plan-free entry point for the public marketplace: a freeform query produces
 * an indicative estimate sourced from MMC's own rate table. Distinct from the
 * plan-driven MMC Quote engine — this does NOT need a project or uploaded plan.
 *
 *   query ──► [cheap LLM parse: classify only] ──► structured intent
 *                                                       │
 *                          structured rate lookup (NSW base) ◄┘
 *                                   │
 *                          computeEstimateRange (deterministic, in code)
 *                                   │
 *                          indicative low/high range + line items
 *
 * The LLM never emits a price; it only maps the query to a cost category +
 * element. The number is computed from rate-table values.
 */

import { callModel } from "@/lib/ai/models";
import { extractJson } from "@/lib/ai/extract-json";
import { REGIONAL_MULTIPLIERS } from "@/lib/ai/types";
import { lookupRatesStructured } from "@/lib/ai/agent/tools/lookup-cost-rate";
import {
  discoveredIntentSchema,
  type DiscoveredIntent,
  type EstimateLineItem,
} from "@/lib/validators/marketplace";
import { MARKETPLACE_PARSE_SYSTEM_PROMPT } from "@/lib/ai/prompts/marketplace-parse";
import { computeEstimateRange } from "./compute-range";

export const ESTIMATE_DISCLAIMER = "Generic rates for guidance only";

export type EstimateStatus = "complete" | "no_rate" | "parse_failed";

export interface EstimateResult {
  status: EstimateStatus;
  lowCents: number | null;
  highCents: number | null;
  currency: "AUD";
  lineItems: EstimateLineItem[];
  rateSourceType: "mmc_base";
  disclaimer: string;
  intent: DiscoveredIntent | null;
}

export async function estimateFromQuery(input: {
  query: string;
  region?: string;
  orgId?: string;
}): Promise<EstimateResult> {
  const base = {
    currency: "AUD" as const,
    rateSourceType: "mmc_base" as const,
    disclaimer: ESTIMATE_DISCLAIMER,
  };

  // 1. Cheap LLM parse — classification only, never pricing.
  let intent: DiscoveredIntent;
  try {
    const res = await callModel("marketplace_parse", {
      system: MARKETPLACE_PARSE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: input.query }],
      maxTokens: 512,
    });
    intent = discoveredIntentSchema.parse(extractJson<unknown>(res.text));
  } catch {
    return {
      ...base,
      status: "parse_failed",
      lowCents: null,
      highCents: null,
      lineItems: [],
      intent: null,
    };
  }

  const region = (input.region ?? intent.region ?? "NSW").toUpperCase();
  const multiplier = REGIONAL_MULTIPLIERS[region] ?? 1;

  // 2. Structured rate lookup — NSW base rates; the regional multiplier is
  //    applied deterministically in computeEstimateRange below.
  const rates = await lookupRatesStructured(
    { category: intent.category, element: intent.element || undefined, state: "NSW" },
    input.orgId
  );

  // 3. Deterministic range.
  const { lowCents, highCents, lineItems } = computeEstimateRange(
    rates,
    intent.quantity,
    multiplier
  );

  if (lowCents === null) {
    return { ...base, status: "no_rate", lowCents: null, highCents: null, lineItems: [], intent };
  }

  return { ...base, status: "complete", lowCents, highCents, lineItems, intent };
}
