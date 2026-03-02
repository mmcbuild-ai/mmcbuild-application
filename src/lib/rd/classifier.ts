import { callModel } from "@/lib/ai/models";
import { extractJson } from "@/lib/ai/extract-json";
import { RD_STAGES, RD_DELIVERABLES } from "@/lib/rd-constants";
import type { RdTag } from "@/lib/supabase/types";
import type { FileMapping } from "./mapper";

export interface ClassificationResult {
  stage: string;
  deliverable: string;
  rd_tag: RdTag;
  confidence: number;
  reasoning: string;
  estimated_hours: number;
}

export async function classifyCommit(opts: {
  sha: string;
  message: string;
  filesChanged: unknown;
  branch: string;
  fileMappings: FileMapping[];
  orgId?: string;
}): Promise<ClassificationResult> {
  const stageDefinitions = RD_STAGES.map(
    (s) => `${s.value}: ${s.label}`
  ).join("\n");

  const deliverableDefinitions = RD_DELIVERABLES.map(
    (d) => `${d.value}: ${d.label}`
  ).join("\n");

  const mappingRules =
    opts.fileMappings.length > 0
      ? opts.fileMappings
          .map(
            (m) =>
              `${m.pattern} → stage=${m.stage}, deliverable=${m.deliverable}, tag=${m.rd_tag} (priority ${m.priority})`
          )
          .join("\n")
      : "No file mapping rules configured.";

  const prompt = `You are an R&D tax classification assistant for Australian software companies.
Given a git commit, classify it for R&D Tax Incentive (Section 355-25 ITAA 1997).

Project stages:
${stageDefinitions}

Deliverables:
${deliverableDefinitions}

File mapping rules:
${mappingRules}

Commit: ${opts.sha}
Message: ${opts.message}
Files changed: ${JSON.stringify(opts.filesChanged)}
Branch: ${opts.branch}

Respond with JSON:
{
  "stage": "stage_1",
  "deliverable": "ai_compliance_engine",
  "rd_tag": "core_rd",
  "confidence": 0.85,
  "reasoning": "Brief justification for classification",
  "estimated_hours": 0.5
}

Classification guidelines:
- core_rd: Novel technical uncertainty — AI/ML experiments, algorithm design, RAG tuning, prompt engineering, new technical approaches
- rd_supporting: Directly enables core R&D — test harnesses for R&D, data pipelines feeding R&D, infrastructure for experiments
- not_eligible: Standard development — UI styling, config changes, dependency updates, documentation, routine bug fixes

Return ONLY valid JSON.`;

  const result = await callModel("rd_classification", {
    messages: [{ role: "user", content: prompt }],
    maxTokens: 1024,
    orgId: opts.orgId,
  });

  const parsed = extractJson<ClassificationResult>(result.text);

  console.log(
    `[RD Classifier] ${opts.sha.slice(0, 7)}: ${parsed.rd_tag} (${parsed.confidence}) — ${parsed.reasoning.slice(0, 80)}`
  );

  return parsed;
}
