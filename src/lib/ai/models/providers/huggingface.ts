/**
 * HuggingFace provider — wraps @huggingface/inference for reranking + classification.
 */

import { InferenceClient } from "@huggingface/inference";
import type { ModelDefinition } from "../registry";
import type { ModelCallOptions, ModelCallResult } from "../call";

let client: InferenceClient | null = null;

function getClient(): InferenceClient {
  if (!client) {
    client = new InferenceClient(process.env.HUGGINGFACE_API_KEY ?? "");
  }
  return client;
}

/**
 * Cross-encoder reranking via HF Inference API.
 * Scores each (query, document) pair and returns scores in order.
 */
export async function callHuggingFaceReranker(
  model: ModelDefinition,
  options: ModelCallOptions
): Promise<ModelCallResult> {
  const hf = getClient();
  const query = options.query!;
  const documents = options.documents!;

  if (documents.length === 0) {
    return {
      text: "",
      scores: [],
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }

  // Use text-classification as cross-encoder scoring
  // Each (query, document) pair gets a relevance score
  const scores: number[] = [];

  // HF reranker models accept pairs via feature-extraction or text-classification
  // We batch-score using sentence pairs
  for (const doc of documents) {
    try {
      const result = await hf.textClassification({
        model: model.modelId,
        inputs: `${query} [SEP] ${doc}`,
      });

      // Cross-encoder rerankers return a relevance score
      const score = Array.isArray(result) && result.length > 0
        ? result[0].score
        : 0;
      scores.push(score);
    } catch {
      // If individual scoring fails, assign 0
      scores.push(0);
    }
  }

  // Rough token estimate for tracking
  const totalChars = query.length + documents.reduce((s, d) => s + d.length, 0);
  const estimatedTokens = Math.ceil(totalChars / 4);

  return {
    text: "",
    scores,
    usage: {
      inputTokens: estimatedTokens,
      outputTokens: 0,
    },
  };
}
