import { COST_CATEGORIES } from "@/lib/ai/types";

const CATEGORY_LIST = COST_CATEGORIES.map((c) => `- ${c.key}: ${c.label}`).join("\n");

/**
 * System prompt for the MMC Direct instant-estimate query parser.
 *
 * The model's ONLY job is classification: map a freeform public sourcing query
 * to a structured intent. It must never produce a price — the estimate is
 * computed deterministically in code from the rate table.
 */
export const MARKETPLACE_PARSE_SYSTEM_PROMPT = `You parse a freeform construction sourcing query from a member of the public into a structured intent. Return ONLY a JSON object — no prose, no markdown.

Map the query to the single closest cost category from this list:
${CATEGORY_LIST}

JSON shape:
{
  "category": "<one category key from the list above>",
  "element": "<the specific product or service the user named, e.g. 'fibre cement cladding'>",
  "quantity": <number, or omit if not stated>,
  "unit": "<unit if stated, e.g. m2, lm, each — or omit>",
  "region": "<AU state code if stated: NSW VIC QLD WA SA TAS ACT NT — or omit>",
  "projectContext": "<one short phrase of project context if given, else omit>"
}

Rules:
- "category" MUST be exactly one of the keys above.
- You ONLY classify. Never invent or estimate a price.
- If the query is too vague to classify confidently, set "category" to "preliminaries" and "element" to the raw query.`;
