import Anthropic from "@anthropic-ai/sdk";
import { COMPLIANCE_SYSTEM_PROMPT } from "./prompts/compliance-system";
import { SECTION_ANALYSIS_TEMPLATE } from "./prompts/compliance-section";
import { extractJson } from "./extract-json";
import type { ComplianceSectionResult, NccCategory } from "./types";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function analyseCompliance(
  category: NccCategory,
  planContent: string,
  projectContext: string,
  nccContext: string
): Promise<ComplianceSectionResult> {
  const userPrompt = SECTION_ANALYSIS_TEMPLATE(
    category,
    planContent,
    projectContext,
    nccContext
  );

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: COMPLIANCE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  const result = extractJson<ComplianceSectionResult>(textBlock.text);

  console.log(
    `[Claude] ${category}: ${result.findings.length} findings, ` +
      `tokens: ${response.usage.input_tokens}+${response.usage.output_tokens}`
  );

  return result;
}

export async function generateSummary(
  findings: ComplianceSectionResult[],
  projectContext: string
): Promise<{ summary: string; overall_risk: "low" | "medium" | "high" | "critical" }> {
  const findingsSummary = findings
    .flatMap((s) => s.findings)
    .map(
      (f) =>
        `[${f.severity.toUpperCase()}] ${f.category} — ${f.title}: ${f.description}`
    )
    .join("\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: COMPLIANCE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Based on the following compliance findings, provide an overall summary and risk rating.

${projectContext}

FINDINGS:
${findingsSummary}

Respond with JSON:
{
  "summary": "string — 2-4 sentence executive summary of compliance status",
  "overall_risk": "low | medium | high | critical"
}

Return ONLY valid JSON.`,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  return extractJson<{ summary: string; overall_risk: "low" | "medium" | "high" | "critical" }>(
    textBlock.text
  );
}
