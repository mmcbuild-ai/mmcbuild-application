/**
 * Security Gate Adapter for MMC Build
 *
 * Bridges MMC Build's callModel() interface with Platform Trust's
 * @platform-trust/security-gate CaMeL pipeline.
 *
 * Usage:
 *   const gate = createMMCSecurityGate({ orgId, checkId, agentId })
 *   const result = await gate.wrap({ trustedInput, untrustedInput, ... })
 */

import {
  createSecurityGate,
  type SecurityGate,
  type SecurityGateConfig,
  type ModelCallFn,
  type PolicyLevel,
  type ToolCall as GateToolCall,
  type ToolResult as GateToolResult,
} from "@platform-trust/security-gate";
import { callModel } from "@/lib/ai/models";
import type { AIFunction } from "@/lib/ai/models/registry";
import type { ToolDefinition, ToolUseBlock } from "@/lib/ai/models/call";

// ---------------------------------------------------------------------------
// Platform Trust Supabase client (optional — for logging)
// ---------------------------------------------------------------------------

let _trustClient: import("@supabase/supabase-js").SupabaseClient | null = null;

async function getTrustClient() {
  if (_trustClient) return _trustClient;

  const url = process.env.PLATFORM_TRUST_SUPABASE_URL;
  const key = process.env.PLATFORM_TRUST_SERVICE_KEY;

  if (!url || !key) {
    console.warn(
      "[security-gate] PLATFORM_TRUST_SUPABASE_URL or PLATFORM_TRUST_SERVICE_KEY not set. " +
        "Security gate will operate without Supabase logging."
    );
    return null;
  }

  const { createClient } = await import("@supabase/supabase-js");
  _trustClient = createClient(url, key);
  return _trustClient;
}

// ---------------------------------------------------------------------------
// Adapter: MMC Build callModel → Security Gate ModelCallFn
// ---------------------------------------------------------------------------

/**
 * Wrap MMC Build's callModel() to match the security gate's ModelCallFn interface.
 */
function adaptCallModel(aiFunction: AIFunction): ModelCallFn {
  return async (opts) => {
    const messages = opts.messages?.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Convert gate tool definitions to MMC Build's format (they're the same shape)
    const tools = opts.tools as ToolDefinition[] | undefined;

    const result = await callModel(aiFunction, {
      system: opts.system,
      messages,
      tools,
      maxTokens: opts.maxTokens,
    });

    return {
      text: result.text,
      toolCalls: result.toolCalls?.map((tc) => ({
        id: tc.id,
        name: tc.name,
        input: tc.input,
      })),
      usage: result.usage,
    };
  };
}

// ---------------------------------------------------------------------------
// Tool Executor Adapter
// ---------------------------------------------------------------------------

type MMCToolExecutor = (
  toolCall: ToolUseBlock,
  context: Record<string, unknown>
) => Promise<string>;

/**
 * Wrap MMC Build's tool executor to match the security gate's interface.
 */
function adaptToolExecutor(
  executor: MMCToolExecutor,
  context: Record<string, unknown>
): (toolCall: GateToolCall) => Promise<GateToolResult> {
  return async (toolCall) => {
    try {
      const mmcToolCall: ToolUseBlock = {
        type: "tool_use",
        id: toolCall.id,
        name: toolCall.name,
        input: toolCall.input,
      };

      const output = await executor(mmcToolCall, context);
      return { tool_call_id: toolCall.id, output };
    } catch (err) {
      return {
        tool_call_id: toolCall.id,
        output: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface MMCSecurityGateConfig {
  /** MMC Build org ID */
  orgId: string;
  /** Compliance check or quote ID */
  checkId: string;
  /** Agent identifier (e.g. "compliance-agent", "cost-agent") */
  agentId: string;
  /** AI function for quarantine (cheap model, no tools). Defaults to "summary" (Sonnet) */
  quarantineFunction?: AIFunction;
  /** AI function for planner (powerful model, with tools). Defaults to the function-specific one */
  plannerFunction: AIFunction;
  /** Policy level. Defaults to "strict" */
  policyLevel?: PolicyLevel;
  /** MMC Build tool executor function */
  executeToolCall?: MMCToolExecutor;
  /** Additional context passed to tool executor */
  toolContext?: Record<string, unknown>;
}

const MMC_BUILD_PROJECT_ID =
  process.env.PLATFORM_TRUST_PROJECT_ID ?? "mmc-build";

/**
 * Create a security gate instance configured for MMC Build.
 *
 * Handles:
 * - Adapting callModel() to the gate's ModelCallFn interface
 * - Connecting to Platform Trust Supabase for logging
 * - Wrapping the tool executor
 */
export async function createMMCSecurityGate(
  config: MMCSecurityGateConfig
): Promise<SecurityGate> {
  const trustClient = await getTrustClient();

  const gateConfig: SecurityGateConfig = {
    projectId: MMC_BUILD_PROJECT_ID,
    agentId: config.agentId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: (trustClient ?? undefined) as any,
    quarantineModel: adaptCallModel(config.quarantineFunction ?? "summary"),
    plannerModel: adaptCallModel(config.plannerFunction),
    policy: { level: config.policyLevel ?? "strict" },
  };

  if (config.executeToolCall) {
    gateConfig.executeToolCall = adaptToolExecutor(
      config.executeToolCall,
      config.toolContext ?? {
        orgId: config.orgId,
        checkId: config.checkId,
      }
    );
  }

  return createSecurityGate(gateConfig);
}

/**
 * Feature flag — allows gradual rollout.
 * Set ENABLE_SECURITY_GATE=true to activate.
 */
export function isSecurityGateEnabled(): boolean {
  return process.env.ENABLE_SECURITY_GATE === "true";
}
