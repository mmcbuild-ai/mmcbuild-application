/**
 * Prompt Enricher — injects few-shot examples from positively-rated findings
 * to help the model learn the organization's preferred level of detail and framing.
 */

import { createAdminClient } from "@/lib/supabase/admin";

interface FeedbackExample {
  ncc_section: string;
  title: string;
  description: string;
  recommendation: string;
  severity: string;
}

/**
 * Get few-shot examples from highly-rated findings in the same category.
 * Returns a formatted string to append to the category prompt.
 */
export async function getFewShotExamples(
  category: string,
  orgId: string,
  limit: number = 3
): Promise<string> {
  const admin = createAdminClient();

  // Get findings with positive feedback (rating = 1) for this category/org
  const { data, error } = await admin
    .from("finding_feedback")
    .select(`
      rating,
      finding:compliance_findings!inner(
        ncc_section,
        title,
        description,
        recommendation,
        severity,
        category
      )
    `)
    .eq("org_id", orgId)
    .eq("rating", 1)
    .order("created_at", { ascending: false })
    .limit(limit * 3); // Fetch extra to filter by category

  if (error || !data || data.length === 0) {
    return "";
  }

  // Filter to matching category and take up to limit
  const examples: FeedbackExample[] = [];
  for (const row of data as Array<{ rating: number; finding: FeedbackExample & { category: string } }>) {
    if (row.finding?.category === category && examples.length < limit) {
      examples.push(row.finding);
    }
  }

  if (examples.length === 0) return "";

  const formatted = examples
    .map(
      (ex, i) =>
        `Example ${i + 1} (positively rated by user):
  NCC Section: ${ex.ncc_section}
  Title: ${ex.title}
  Severity: ${ex.severity}
  Description: ${ex.description.slice(0, 200)}
  Recommendation: ${ex.recommendation?.slice(0, 200) ?? "N/A"}`
    )
    .join("\n\n");

  return `\n\nPREVIOUSLY WELL-RATED FINDINGS FOR THIS CATEGORY (match this style and detail level):\n${formatted}\n`;
}
