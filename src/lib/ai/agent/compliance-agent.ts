/**
 * Compliance Agent — agentic analysis using Claude's tool_use for dynamic
 * context retrieval, cross-category awareness, and iterative deepening.
 */

import { callModel, type ToolDefinition, type ToolUseBlock } from "@/lib/ai/models";
import { COMPLIANCE_SYSTEM_PROMPT } from "@/lib/ai/prompts/compliance-system";
import { SECTION_ANALYSIS_TEMPLATE } from "@/lib/ai/prompts/compliance-section";
import { extractJson } from "@/lib/ai/extract-json";
import type { ComplianceSectionResult, NccCategory } from "@/lib/ai/types";

import {
  lookupNccClauseDef,
  executeLookupNccClause,
} from "./tools/lookup-ncc-clause";
import {
  getRelatedFindingsDef,
  executeGetRelatedFindings,
} from "./tools/get-related-findings";
import {
  retrieveAdditionalContextDef,
  executeRetrieveAdditionalContext,
} from "./tools/retrieve-additional-context";
import {
  flagDependencyDef,
  executeFlagDependency,
  type CrossCategoryDependency,
} from "./tools/flag-dependency";
export type { CrossCategoryDependency } from "./tools/flag-dependency";

const MAX_ITERATIONS = 5;

const AGENT_TOOLS: ToolDefinition[] = [
  lookupNccClauseDef,
  getRelatedFindingsDef,
  retrieveAdditionalContextDef,
  flagDependencyDef,
];

interface AgentContext {
  orgId: string;
  checkId: string;
  priorResults: Map<string, ComplianceSectionResult>;
  dependencies: CrossCategoryDependency[];
}

interface AgentResult {
  result: ComplianceSectionResult;
  dependencies: CrossCategoryDependency[];
  iterations: number;
}

/**
 * Run agentic analysis for a single category.
 * The agent can use tools to look up NCC clauses, access prior findings,
 * retrieve additional context, and flag cross-category dependencies.
 */
export async function runAgentAnalysis(
  category: NccCategory,
  planContent: string,
  projectContext: string,
  nccContext: string,
  agentContext: AgentContext
): Promise<AgentResult> {
  const dependencies: CrossCategoryDependency[] = [];

  const sectionPrompt = SECTION_ANALYSIS_TEMPLATE(
    category,
    planContent,
    projectContext,
    nccContext
  );

  const agentInstruction = `You are performing a detailed NCC compliance analysis for the "${category}" category.

You have access to tools that allow you to:
1. Look up specific NCC clauses for more detail
2. Check findings from other categories that have already been analyzed
3. Retrieve additional reference material if the initial context is insufficient
4. Flag cross-category dependencies when you find issues that affect other categories

IMPORTANT: Use tools strategically. Don't look up every clause — only when you need more detail than what's provided in the initial context. Focus on accuracy and thoroughness.

After using tools (if needed), provide your final analysis as a JSON response matching the required schema.

${sectionPrompt}`;

  // Build initial messages
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [
    { role: "user", content: agentInstruction },
  ];

  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const response = await callModel("compliance_primary", {
      system: COMPLIANCE_SYSTEM_PROMPT,
      messages,
      tools: AGENT_TOOLS,
      maxTokens: 4096,
      orgId: agentContext.orgId,
      checkId: agentContext.checkId,
    });

    // If no tool calls, the agent is done
    if (!response.toolCalls || response.toolCalls.length === 0) {
      // Extract the final JSON result from the text
      const result = extractJson<ComplianceSectionResult>(response.text);
      return { result, dependencies, iterations };
    }

    // Execute tool calls
    const toolResults: string[] = [];
    for (const toolCall of response.toolCalls) {
      const toolResult = await executeToolCall(toolCall, {
        ...agentContext,
        dependencies,
      });
      toolResults.push(toolResult);
    }

    // Add assistant response + tool results to conversation
    // Build a summary of what happened
    const toolSummary = response.toolCalls
      .map((tc, i) => `Tool: ${tc.name}\nInput: ${JSON.stringify(tc.input)}\nResult: ${toolResults[i]}`)
      .join("\n\n");

    messages.push({
      role: "assistant",
      content: response.text || `[Used ${response.toolCalls.length} tools]`,
    });
    messages.push({
      role: "user",
      content: `Tool results:\n\n${toolSummary}\n\nContinue your analysis. When ready, provide your final JSON response.`,
    });
  }

  // Hit max iterations — extract whatever we have
  const lastAttempt = await callModel("compliance_primary", {
    system: COMPLIANCE_SYSTEM_PROMPT,
    messages: [
      ...messages,
      {
        role: "user",
        content: "Maximum iterations reached. Provide your final analysis JSON now.",
      },
    ],
    maxTokens: 4096,
    orgId: agentContext.orgId,
    checkId: agentContext.checkId,
  });

  const result = extractJson<ComplianceSectionResult>(lastAttempt.text);
  return { result, dependencies, iterations };
}

async function executeToolCall(
  toolCall: ToolUseBlock,
  context: AgentContext & { dependencies: CrossCategoryDependency[] }
): Promise<string> {
  const input = toolCall.input;

  switch (toolCall.name) {
    case "lookup_ncc_clause":
      return executeLookupNccClause(
        input as { clause_number: string; context_query?: string },
        { orgId: context.orgId }
      );

    case "get_related_findings":
      return executeGetRelatedFindings(
        input as { categories: string[]; severity_filter?: string },
        { priorResults: context.priorResults }
      );

    case "retrieve_additional_context":
      return executeRetrieveAdditionalContext(
        input as { query: string; source_type?: string; max_results?: number },
        { orgId: context.orgId }
      );

    case "flag_cross_category_dependency":
      return executeFlagDependency(
        input as unknown as CrossCategoryDependency,
        { dependencies: context.dependencies }
      );

    default:
      return `Unknown tool: ${toolCall.name}`;
  }
}

/**
 * Category execution phases for dependency-aware parallel analysis.
 * Categories in the same phase can run concurrently.
 */
export const EXECUTION_PHASES: NccCategory[][] = [
  // Phase A: Independent foundations
  ["structural", "fire_safety", "energy_efficiency"],
  // Phase B: Depends on Phase A
  ["waterproofing", "weatherproofing", "bushfire"],
  // Phase C: Depends on A+B
  ["ventilation", "glazing", "health_amenity", "safe_movement"],
  // Phase D: Depends on all above
  ["ancillary", "livable_housing", "termite", "accessibility"],
];

/**
 * Get the phase index for a category.
 */
export function getCategoryPhase(category: string): number {
  for (let i = 0; i < EXECUTION_PHASES.length; i++) {
    if (EXECUTION_PHASES[i].includes(category as NccCategory)) return i;
  }
  return EXECUTION_PHASES.length - 1;
}
