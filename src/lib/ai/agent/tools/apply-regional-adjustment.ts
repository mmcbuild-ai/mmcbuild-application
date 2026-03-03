/**
 * Agent Tool: apply_regional_adjustment
 * Applies state-based cost multipliers for Australian regional pricing.
 */

import { REGIONAL_MULTIPLIERS } from "@/lib/ai/types";

export const applyRegionalAdjustmentDef = {
  name: "apply_regional_adjustment",
  description:
    "Get the regional cost multiplier for an Australian state. " +
    "Base rates are NSW (1.0). Multiply rates by this factor for other states. " +
    "Use this when the project is outside NSW.",
  input_schema: {
    type: "object" as const,
    properties: {
      state: {
        type: "string",
        enum: ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"],
        description: "The Australian state or territory",
      },
      base_amount: {
        type: "number",
        description: "Optional: a base amount (in AUD) to adjust. Returns the adjusted amount.",
      },
    },
    required: ["state"],
  },
};

export function executeApplyRegionalAdjustment(
  input: { state: string; base_amount?: number }
): string {
  const multiplier = REGIONAL_MULTIPLIERS[input.state];

  if (multiplier === undefined) {
    return `Unknown state: "${input.state}". Valid states: ${Object.keys(REGIONAL_MULTIPLIERS).join(", ")}. Defaulting to NSW (1.0).`;
  }

  if (input.base_amount !== undefined) {
    const adjusted = Math.round(input.base_amount * multiplier);
    return `Regional adjustment for ${input.state}: multiplier = ${multiplier}, $${input.base_amount.toLocaleString()} → $${adjusted.toLocaleString()}`;
  }

  return `Regional multiplier for ${input.state}: ${multiplier} (relative to NSW = 1.0). Multiply all NSW base rates by ${multiplier}.`;
}
