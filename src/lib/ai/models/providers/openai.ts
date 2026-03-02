/**
 * OpenAI provider — wraps the OpenAI SDK for chat + embeddings.
 */

import OpenAI from "openai";
import type { ModelDefinition } from "../registry";
import type { ModelCallOptions, ModelCallResult } from "../call";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  }
  return client;
}

export async function callOpenAI(
  model: ModelDefinition,
  options: ModelCallOptions
): Promise<ModelCallResult> {
  const openai = getClient();

  const messages = (options.messages ?? []).map((m) => ({
    role: m.role as "system" | "user" | "assistant",
    content: m.content,
  }));

  // Inject system message if provided separately
  if (options.system && !messages.some((m) => m.role === "system")) {
    messages.unshift({ role: "system", content: options.system });
  }

  const response = await openai.chat.completions.create({
    model: model.modelId,
    max_tokens: options.maxTokens ?? model.maxOutput,
    messages,
  });

  const choice = response.choices[0];

  return {
    text: choice?.message?.content ?? "",
    stopReason: choice?.finish_reason ?? undefined,
    usage: {
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
    },
  };
}

export async function callOpenAIEmbedding(
  model: ModelDefinition,
  options: ModelCallOptions
): Promise<ModelCallResult> {
  const openai = getClient();

  const input = options.input!;
  const dimensions = options.dimensions ?? 1536;

  const response = await openai.embeddings.create({
    model: model.modelId,
    input,
    dimensions,
  });

  return {
    text: "",
    embeddings: response.data.map((d) => d.embedding),
    usage: {
      inputTokens: response.usage.total_tokens,
      outputTokens: 0,
    },
  };
}
