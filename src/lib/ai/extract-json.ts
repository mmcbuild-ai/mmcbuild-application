/**
 * Extract JSON from LLM responses that may contain markdown fences,
 * explanatory text, or partial JSON.
 */
export function extractJson<T>(text: string): T {
  // Try direct parse first
  try {
    return JSON.parse(text) as T;
  } catch {
    // Continue to extraction strategies
  }

  // Try extracting from markdown code fences
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim()) as T;
    } catch {
      // Continue
    }
  }

  // Try finding JSON object or array in the text
  const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]) as T;
    } catch {
      // Try fixing common issues: trailing commas
      const cleaned = jsonMatch[1]
        .replace(/,\s*([\]}])/g, "$1")
        .replace(/'/g, '"');
      try {
        return JSON.parse(cleaned) as T;
      } catch {
        // Continue
      }
    }
  }

  throw new Error(
    `Failed to extract JSON from LLM response. First 200 chars: ${text.slice(0, 200)}`
  );
}
