/**
 * Deterministic estimate-range maths for the MMC Direct instant estimate.
 *
 * The price NEVER comes from an LLM. It is derived from rate-table values,
 * regionally adjusted in code, with an indicative band so the result reads as
 * a range — not a quote.
 *
 *   rate.base_rate ──×── regionMultiplier ──×── quantity
 *        │                                          │
 *        └── per matched element, apply ±15% indicative band ──┐
 *                                                              ▼
 *   overall range = [ min(itemLow) , max(itemHigh) ]
 *   (multiple matches are alternatives, e.g. cladding types — not summed)
 *
 * This module has NO LLM imports so it is trivially unit-testable.
 */

import { estimateLineItemSchema, type EstimateLineItem } from "@/lib/validators/marketplace";
import type { RateResult } from "@/lib/ai/agent/tools/lookup-cost-rate";

export const INDICATIVE_BAND = 0.15; // ±15%

export interface EstimateRange {
  lowCents: number | null;
  highCents: number | null;
  lineItems: EstimateLineItem[];
}

export function computeEstimateRange(
  rates: RateResult[],
  quantity: number | undefined,
  regionMultiplier: number
): EstimateRange {
  if (rates.length === 0) {
    return { lowCents: null, highCents: null, lineItems: [] };
  }

  const qty = quantity && quantity > 0 ? quantity : 1;
  const mult = regionMultiplier > 0 ? regionMultiplier : 1;

  const lineItems: EstimateLineItem[] = rates.map((r) => {
    const adjusted = r.base_rate * mult * qty;
    const lowCents = Math.max(0, Math.round(adjusted * (1 - INDICATIVE_BAND) * 100));
    const highCents = Math.max(0, Math.round(adjusted * (1 + INDICATIVE_BAND) * 100));
    // Zod-validate the boundary (low <= high, non-negative) before it leaves here.
    return estimateLineItemSchema.parse({
      label: `${r.element} (${r.unit})`,
      lowCents,
      highCents,
    });
  });

  return {
    lowCents: Math.min(...lineItems.map((li) => li.lowCents)),
    highCents: Math.max(...lineItems.map((li) => li.highCents)),
    lineItems,
  };
}
