/**
 * Cost Estimation Agent — agentic analysis using Claude's tool_use for
 * rate lookups, quantity extraction, cross-category cost awareness,
 * and MMC alternative pricing via the Build module.
 *
 * When ENABLE_SECURITY_GATE=true, routes through the CaMeL security pipeline
 * which splits untrusted PDF content from the privileged tool-calling LLM.
 */

import { callModel, type ToolDefinition, type ToolUseBlock } from "@/lib/ai/models";
import {
  COST_ESTIMATION_SYSTEM_PROMPT,
  COST_CATEGORY_PROMPT,
} from "@/lib/ai/prompts/cost-estimation-system";
import { extractJson } from "@/lib/ai/extract-json";
import type { CostCategoryResult, CostCategory } from "@/lib/ai/types";
import { getCostCategoryLabel } from "@/lib/ai/types";
import {
  createMMCSecurityGate,
  isSecurityGateEnabled,
} from "@/lib/ai/security/gate-adapter";

import {
  extractQuantitiesDef,
  executeExtractQuantities,
} from "./tools/extract-quantities";
import {
  lookupCostRateDef,
  executeLookupCostRate,
} from "./tools/lookup-cost-rate";
import {
  getDesignSuggestionsDef,
  executeGetDesignSuggestions,
} from "./tools/get-design-suggestions";
import {
  applyRegionalAdjustmentDef,
  executeApplyRegionalAdjustment,
} from "./tools/apply-regional-adjustment";
import {
  getPriorEstimatesDef,
  executeGetPriorEstimates,
} from "./tools/get-prior-estimates";
import {
  flagCostDependencyDef,
  executeFlagCostDependency,
  type CostDependency,
} from "./tools/flag-cost-dependency";

export type { CostDependency } from "./tools/flag-cost-dependency";

const MAX_ITERATIONS = 5;

const AGENT_TOOLS: ToolDefinition[] = [
  extractQuantitiesDef,
  lookupCostRateDef,
  getDesignSuggestionsDef,
  applyRegionalAdjustmentDef,
  getPriorEstimatesDef,
  flagCostDependencyDef,
];

interface CostAgentContext {
  orgId: string;
  estimateId: string;
  projectId: string;
  planId: string;
  priorResults: Map<string, CostCategoryResult>;
  dependencies: CostDependency[];
}

interface CostAgentResult {
  result: CostCategoryResult;
  dependencies: CostDependency[];
  iterations: number;
}

/**
 * Run agentic cost estimation for a single category.
 *
 * When ENABLE_SECURITY_GATE=true, routes through the CaMeL pipeline:
 * - planContent (untrusted PDF) → quarantined LLM (no tools, extraction only)
 * - User query + extracted data → privileged LLM (tools, policy-gated)
 */
export async function runCostAgent(
  category: CostCategory,
  planContent: string,
  projectContext: string,
  agentContext: CostAgentContext
): Promise<CostAgentResult> {
  if (isSecurityGateEnabled()) {
    return runSecureCostAgent(category, planContent, projectContext, agentContext);
  }
  return runDirectCostAgent(category, planContent, projectContext, agentContext);
}

/**
 * Secure path — CaMeL pipeline via @platform-trust/security-gate.
 */
async function runSecureCostAgent(
  category: CostCategory,
  planContent: string,
  projectContext: string,
  agentContext: CostAgentContext
): Promise<CostAgentResult> {
  const dependencies: CostDependency[] = [];
  const categoryLabel = getCostCategoryLabel(category);

  const gate = await createMMCSecurityGate({
    orgId: agentContext.orgId,
    checkId: agentContext.estimateId,
    agentId: `cost-${category}`,
    quarantineFunction: "summary",
    plannerFunction: "cost_primary",
    policyLevel: "strict",
    executeToolCall: (tc) =>
      executeCostToolCall(tc, { ...agentContext, dependencies }),
    toolContext: {
      orgId: agentContext.orgId,
      estimateId: agentContext.estimateId,
      projectId: agentContext.projectId,
      planId: agentContext.planId,
      priorResults: agentContext.priorResults,
      dependencies,
    },
  });

  const categoryPrompt = COST_CATEGORY_PROMPT(
    category,
    categoryLabel,
    planContent,
    projectContext
  );

  const result = await gate.wrap({
    trustedInput: `Perform a detailed cost estimate for the "${categoryLabel}" category of an Australian residential building project.\n\n${categoryPrompt}`,
    untrustedInput: planContent,
    systemPrompt: COST_ESTIMATION_SYSTEM_PROMPT,
    extractionPrompt: `Extract all construction quantities, dimensions, materials, specifications, and measurable elements from this building plan document. Include:
- Floor areas and room dimensions
- Structural quantities (concrete volumes, steel tonnage, timber lengths)
- Material specifications (type, grade, finish)
- Fixture and fitting counts
- Services runs (electrical, plumbing, HVAC)
- Site works quantities
Return structured factual data only. Do not estimate costs.`,
    tools: AGENT_TOOLS,
    maxTokens: 4096,
  });

  if (result.violations.length > 0) {
    console.warn(
      `[SecurityGate] cost-${category}: ${result.violations.length} policy violations`,
      result.violations.map((v: { toolCall: { name: string }; taintedFields: string[]; action: string }) => ({
        tool: v.toolCall.name,
        tainted: v.taintedFields,
        action: v.action,
      }))
    );
  }

  if (result.killed) {
    console.error(`[SecurityGate] cost-${category}: Session terminated`);
    throw new Error(
      `Security gate terminated cost estimation for ${category}: ${result.text}`
    );
  }

  const parsed = safeExtractResult(result.text, category);
  return { result: parsed, dependencies, iterations: 1 };
}

/**
 * Direct path — original implementation without security gate.
 */
async function runDirectCostAgent(
  category: CostCategory,
  planContent: string,
  projectContext: string,
  agentContext: CostAgentContext
): Promise<CostAgentResult> {
  const dependencies: CostDependency[] = [];
  const categoryLabel = getCostCategoryLabel(category);

  const categoryPrompt = COST_CATEGORY_PROMPT(
    category,
    categoryLabel,
    planContent,
    projectContext
  );

  const agentInstruction = `You are performing a detailed cost estimate for the "${categoryLabel}" category of an Australian residential building project.

You have access to tools that allow you to:
1. Extract quantities from the building plan
2. Look up reference cost rates from the Australian construction rates database
3. Access MMC design suggestions from a completed Build report (if available)
4. Apply regional cost adjustments for states other than NSW
5. Check estimates from already-costed categories
6. Flag cross-category cost dependencies

IMPORTANT WORKFLOW:
1. First, use lookup_cost_rate to get reference rates for this category
2. Then, use extract_quantities if you need more detail about specific elements
3. Check get_design_suggestions for any MMC alternatives relevant to this category
4. Use apply_regional_adjustment if the project is outside NSW
5. Use get_prior_estimates if you need to reference other categories
6. Flag dependencies that affect other categories

After using tools, provide your final cost estimate as JSON.

${categoryPrompt}`;

  const messages: Array<{ role: "user" | "assistant"; content: string }> = [
    { role: "user", content: agentInstruction },
  ];

  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const response = await callModel("cost_primary", {
      system: COST_ESTIMATION_SYSTEM_PROMPT,
      messages,
      tools: AGENT_TOOLS,
      maxTokens: 4096,
      orgId: agentContext.orgId,
      checkId: agentContext.estimateId,
    });

    // If no tool calls, the agent is done
    if (!response.toolCalls || response.toolCalls.length === 0) {
      const result = safeExtractResult(response.text, category);
      return { result, dependencies, iterations };
    }

    // Execute tool calls
    const toolResults: string[] = [];
    for (const toolCall of response.toolCalls) {
      const toolResult = await executeCostToolCall(toolCall, {
        ...agentContext,
        dependencies,
      });
      toolResults.push(toolResult);
    }

    const toolSummary = response.toolCalls
      .map((tc, i) => `Tool: ${tc.name}\nInput: ${JSON.stringify(tc.input)}\nResult: ${toolResults[i]}`)
      .join("\n\n");

    messages.push({
      role: "assistant",
      content: response.text || `[Used ${response.toolCalls.length} tools]`,
    });
    messages.push({
      role: "user",
      content: `Tool results:\n\n${toolSummary}\n\nContinue your cost estimate. When ready, provide your final JSON response.`,
    });
  }

  // Hit max iterations — force a response
  const lastAttempt = await callModel("cost_primary", {
    system: COST_ESTIMATION_SYSTEM_PROMPT,
    messages: [
      ...messages,
      {
        role: "user",
        content: "Maximum iterations reached. Provide your final cost estimate JSON now.",
      },
    ],
    maxTokens: 4096,
    orgId: agentContext.orgId,
    checkId: agentContext.estimateId,
  });

  const result = safeExtractResult(lastAttempt.text, category);
  return { result, dependencies, iterations };
}

/**
 * Safely extract a CostCategoryResult from AI text.
 * Falls back to an empty result if JSON extraction fails.
 */
function safeExtractResult(text: string, category: string): CostCategoryResult {
  try {
    return extractJson<CostCategoryResult>(text);
  } catch (err) {
    console.error(
      `[CostAgent] Failed to extract JSON for "${category}": ${err instanceof Error ? err.message : err}`
    );
    // Return empty result rather than crashing the entire pipeline
    return { category, line_items: [] };
  }
}

async function executeCostToolCall(
  toolCall: ToolUseBlock,
  context: CostAgentContext & { dependencies: CostDependency[] }
): Promise<string> {
  const input = toolCall.input;

  switch (toolCall.name) {
    case "extract_quantities":
      return executeExtractQuantities(
        input as { category: string; specific_elements?: string },
        { orgId: context.orgId, planId: context.planId }
      );

    case "lookup_cost_rate":
      return executeLookupCostRate(
        input as { category: string; element?: string; state?: string },
        context.orgId
      );

    case "get_design_suggestions":
      return executeGetDesignSuggestions(
        input as { category_filter?: string },
        { projectId: context.projectId }
      );

    case "apply_regional_adjustment":
      return executeApplyRegionalAdjustment(
        input as { state: string; base_amount?: number }
      );

    case "get_prior_estimates":
      return executeGetPriorEstimates(
        input as { categories: string[] },
        { priorResults: context.priorResults }
      );

    case "flag_cost_dependency":
      return executeFlagCostDependency(
        input as CostDependency,
        { dependencies: context.dependencies }
      );

    default:
      return `Unknown tool: ${toolCall.name}`;
  }
}
