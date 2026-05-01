/**
 * Anthropic provider — wraps the Anthropic SDK for chat + tool_use.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { ModelDefinition } from "../registry";
import type { ModelCallOptions, ModelCallResult, ToolUseBlock } from "../call";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const k = process.env.ANTHROPIC_API_KEY;
    console.log(
      `[Anthropic] init — keyPresent=${!!k} len=${k?.length ?? 0} last4=${k?.slice(-4) ?? "NONE"}`
    );
    client = new Anthropic({ apiKey: k! });
  }
  return client;
}

export async function callAnthropic(
  model: ModelDefinition,
  options: ModelCallOptions
): Promise<ModelCallResult> {
  const anthropic = getClient();

  const rawMessages = (options.messages ?? []).filter((m) => m.role !== "system");
  const firstUserIdx = rawMessages.findIndex((x) => x.role === "user");

  // If cacheUserPrefix and/or images are set, the first user message becomes
  // a content-block array. Caching prefix is at 10% input cost on hit;
  // images attach as base64 source blocks before the user's text.
  const messages = rawMessages.map((m, idx) => {
    const isFirstUser = m.role === "user" && idx === firstUserIdx;
    const hasPrefix = isFirstUser && options.cacheUserPrefix;
    const hasImages = isFirstUser && options.images && options.images.length > 0;

    if (hasPrefix || hasImages) {
      const blocks: Anthropic.ContentBlockParam[] = [];
      if (hasPrefix) {
        blocks.push({
          type: "text",
          text: options.cacheUserPrefix!,
          cache_control: { type: "ephemeral" },
        });
      }
      if (hasImages) {
        for (const img of options.images!) {
          blocks.push({
            type: "image",
            source: {
              type: "base64",
              media_type: img.mimeType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
              data: img.data.toString("base64"),
            },
          });
        }
      }
      blocks.push({ type: "text", text: m.content });
      return { role: "user" as const, content: blocks };
    }

    return { role: m.role as "user" | "assistant", content: m.content };
  });

  const systemPrompt =
    options.system ??
    options.messages?.find((m) => m.role === "system")?.content;

  const params: Anthropic.MessageCreateParams = {
    model: model.modelId,
    max_tokens: options.maxTokens ?? model.maxOutput,
    messages: messages as Anthropic.MessageCreateParams["messages"],
  };

  if (systemPrompt) {
    params.system = systemPrompt;
  }

  if (options.tools && options.tools.length > 0) {
    params.tools = options.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema as Anthropic.Tool.InputSchema,
    }));
  }

  const response = await anthropic.messages.create(params);

  const textBlocks = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text);

  const toolCalls = response.content
    .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
    .map(
      (b): ToolUseBlock => ({
        type: "tool_use",
        id: b.id,
        name: b.name,
        input: b.input as Record<string, unknown>,
      })
    );

  return {
    text: textBlocks.join(""),
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    stopReason: response.stop_reason ?? undefined,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheCreationTokens: response.usage.cache_creation_input_tokens ?? undefined,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? undefined,
    },
  };
}
