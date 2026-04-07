/**
 * Security Gate Adapter for MMC Build
 *
 * Bridges MMC Build's callModel() interface with Platform Trust's
 * @platform-trust/security-gate CaMeL pipeline.
 *
 * Uses dynamic import so the build succeeds even when the
 * @platform-trust/security-gate package isn't available (e.g. Vercel).
 * The gate is only loaded at runtime when ENABLE_SECURITY_GATE=true.
 */

import { callModel } from "@/lib/ai/models";
import type { AIFunction } from "@/lib/ai/models/registry";
import type { ToolDefinition, ToolUseBlock } from "@/lib/ai/models/call";

// ---------------------------------------------------------------------------
// Types — structural definitions matching @platform-trust/security-gate
// so consumers don't need the package at compile time.
// ---------------------------------------------------------------------------

export interface SecurityViolation {
  toolCall: { name: string };
  taintedFields: string[];
  action: string;
}

export interface SecurityGateResult {
  text: string;
  toolCalls?: { id: string; name: string; input: unknown }[];
  usage?: { inputTokens: number; outputTokens: number };
  blocked?: boolean;
  reason?: string;
  violations: SecurityViolation[];
  killed: boolean;
}

export interface SecurityGateWrapOpts {
  trustedInput: string;
  untrustedInput: string;
  systemPrompt?: string;
  extractionPrompt?: string;
  tools?: unknown[];
  maxTokens?: number;
}

export interface SecurityGate {
  wrap(opts: SecurityGateWrapOpts): Promise<SecurityGateResult>;
}

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
// Dynamic loader for @platform-trust/security-gate
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadSecurityGateModule(): Promise<any> {
  try {
    // Dynamic import — only resolved at runtime, not at build time
    const mod = await (Function(
      'return import("@platform-trust/security-gate")'
    )() as Promise<{ createSecurityGate: (...args: unknown[]) => SecurityGate }>);
    return mod;
  } catch {
    throw new Error(
      "[security-gate] @platform-trust/security-gate is not available. " +
        "Set ENABLE_SECURITY_GATE=false or install the package."
    );
  }
}

// ---------------------------------------------------------------------------
// Adapter: MMC Build callModel → Security Gate ModelCallFn
// ---------------------------------------------------------------------------

function adaptCallModel(aiFunction: AIFunction) {
  return async (opts: {
    system?: string;
    messages?: { role: string; content: string }[];
    tools?: unknown[];
    maxTokens?: number;
  }) => {
    const messages = opts.messages?.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

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

function adaptToolExecutor(
  executor: MMCToolExecutor,
  context: Record<string, unknown>
) {
  return async (toolCall: { id: string; name: string; input: unknown }) => {
    try {
      const mmcToolCall: ToolUseBlock = {
        type: "tool_use",
        id: toolCall.id,
        name: toolCall.name,
        input: toolCall.input as Record<string, unknown>,
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
  orgId: string;
  checkId: string;
  agentId: string;
  quarantineFunction?: AIFunction;
  plannerFunction: AIFunction;
  policyLevel?: "strict" | "moderate" | "permissive";
  executeToolCall?: MMCToolExecutor;
  toolContext?: Record<string, unknown>;
}

const MMC_BUILD_PROJECT_ID =
  process.env.PLATFORM_TRUST_PROJECT_ID ?? "mmc-build";

export async function createMMCSecurityGate(
  config: MMCSecurityGateConfig
): Promise<SecurityGate> {
  const mod = await loadSecurityGateModule();
  const trustClient = await getTrustClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gateConfig: Record<string, any> = {
    projectId: MMC_BUILD_PROJECT_ID,
    agentId: config.agentId,
    supabase: trustClient ?? undefined,
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
      },
    );
  }

  return mod.createSecurityGate(gateConfig) as SecurityGate;
}

/**
 * Feature flag — allows gradual rollout.
 * Set ENABLE_SECURITY_GATE=true to activate.
 */
export function isSecurityGateEnabled(): boolean {
  return process.env.ENABLE_SECURITY_GATE === "true";
}
