/**
 * Confidence Calibrator — adjusts AI confidence scores based on
 * historical accuracy per category, as measured by user feedback.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { ComplianceSectionResult } from "@/lib/ai/types";

interface CategoryAccuracy {
  category: string;
  totalFeedback: number;
  positiveRate: number;
}

/**
 * Get the historical accuracy rate for a category based on feedback.
 */
export async function getCategoryAccuracy(
  category: string,
  orgId: string
): Promise<CategoryAccuracy | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("finding_feedback")
    .select(`
      rating,
      finding:compliance_findings!inner(category)
    `)
    .eq("org_id", orgId);

  if (error || !data || data.length === 0) return null;

  // Filter to category
  const categoryFeedback = (data as Array<{ rating: number; finding: { category: string } }>)
    .filter((row) => row.finding?.category === category);

  if (categoryFeedback.length < 3) return null; // Not enough data

  const positive = categoryFeedback.filter((r) => r.rating >= 0).length;
  const positiveRate = positive / categoryFeedback.length;

  return {
    category,
    totalFeedback: categoryFeedback.length,
    positiveRate,
  };
}

/**
 * Adjust confidence scores on a section result based on historical accuracy.
 *
 * - Category with 90%+ positive feedback → +5% confidence boost (max 0.95)
 * - Category with <60% positive feedback → -10% confidence penalty (min 0.3)
 * - New categories (no feedback yet) → no adjustment
 */
export async function calibrateConfidence(
  result: ComplianceSectionResult,
  orgId: string
): Promise<ComplianceSectionResult> {
  const accuracy = await getCategoryAccuracy(result.category, orgId);

  if (!accuracy) return result; // No data — no adjustment

  let adjustment = 0;
  if (accuracy.positiveRate >= 0.9) {
    adjustment = 0.05;
  } else if (accuracy.positiveRate < 0.6) {
    adjustment = -0.1;
  }

  if (adjustment === 0) return result;

  return {
    ...result,
    findings: result.findings.map((f) => ({
      ...f,
      confidence: Math.min(0.95, Math.max(0.3, f.confidence + adjustment)),
    })),
  };
}
