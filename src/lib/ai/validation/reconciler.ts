/**
 * Reconciler — when primary and secondary models disagree significantly,
 * a reconciliation LLM adjudicates with both analyses + NCC references.
 */

import { callModel } from "@/lib/ai/models";
import { extractJson } from "@/lib/ai/extract-json";
import { COMPLIANCE_SYSTEM_PROMPT } from "@/lib/ai/prompts/compliance-system";
import type { ComplianceSectionResult, NccCategory } from "@/lib/ai/types";

/**
 * Reconcile disagreements between primary and secondary analysis.
 * Uses Claude (reconciliation function) to adjudicate.
 */
export async function reconcileFindings(
  category: NccCategory,
  primary: ComplianceSectionResult,
  secondary: ComplianceSectionResult,
  nccContext: string,
  options?: { orgId?: string; checkId?: string }
): Promise<ComplianceSectionResult> {
  const prompt = `You are adjudicating a disagreement between two independent NCC compliance analyses for the "${category}" category.

PRIMARY ANALYSIS (Model A):
${JSON.stringify(primary, null, 2)}

SECONDARY ANALYSIS (Model B):
${JSON.stringify(secondary, null, 2)}

RELEVANT NCC REFERENCE MATERIAL:
${nccContext.slice(0, 4000)}

Your task:
1. Compare both analyses finding by finding
2. For each disagreement, determine which analysis is more accurate based on the NCC reference material
3. If uncertain, use the MORE CONSERVATIVE (higher severity) rating
4. Combine the best findings from both analyses
5. Add your reasoning in the description where analyses disagreed

Respond with the reconciled result in JSON:
{
  "category": "${category}",
  "findings": [
    {
      "ncc_section": "string",
      "category": "${category}",
      "title": "string",
      "description": "string — include note if this was reconciled from disagreement",
      "recommendation": "string",
      "severity": "compliant | advisory | non_compliant | critical",
      "confidence": 0.0-1.0,
      "ncc_citation": "string",
      "page_references": []
    }
  ]
}

Return ONLY valid JSON.`;

  try {
    const result = await callModel("reconciliation", {
      system: COMPLIANCE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
      maxTokens: 4096,
      orgId: options?.orgId,
      checkId: options?.checkId,
    });

    return extractJson<ComplianceSectionResult>(result.text);
  } catch (err) {
    console.error(`[Reconciler] Failed for ${category}:`, err);
    // Fallback: return primary result
    return primary;
  }
}
