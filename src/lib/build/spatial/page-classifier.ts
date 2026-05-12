/**
 * Floor-plan page classifier.
 *
 * Architectural plan sets are typically delivered as multi-page PDFs:
 * cover → site → floor plans → elevations → sections → details. Our spatial
 * extractor needs a floor plan as input — handing it the cover sheet
 * produces nothing useful and silently disables the 3D viewer + COLLADA
 * export downstream.
 *
 * This module asks Claude Vision a cheap binary question for each page
 * ("is this a floor plan?") at low resolution, returns the first page
 * that qualifies. The caller then re-renders that page at full scale for
 * the real extraction.
 *
 * Limits classification to the first MAX_PAGES_TO_CLASSIFY pages — floor
 * plans always live near the front of an architectural set; scanning the
 * tail of a 100-page tender pack is wasted spend.
 */

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { renderAllPdfPages } from "./pdf-to-image";

const MAX_PAGES_TO_CLASSIFY = 15;
const CLASSIFIER_SCALE = 1.0;
const CLASSIFIER_MODEL = "claude-haiku-4-5-20251001";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  return client;
}

const CLASSIFIER_PROMPT = `You are looking at one page from a multi-page architectural plan set.

Decide whether this page is a FLOOR PLAN — a top-down view of a building showing rooms with walls, doors, and windows, the kind of plan from which spatial layout (rooms / walls / openings) can be extracted.

NOT floor plans (these are NO):
- Cover sheets, title sheets, sheet indexes, revision tables
- Site plans (the building seen from above as a single footprint on a lot)
- Elevations (views of the building from one side)
- Sections (a vertical slice through the building)
- Detail drawings, construction details, joinery details, schedules
- Tables, legends, notes-only pages

YES floor plans:
- "Proposed plan", "ground floor plan", "first floor plan", "floor plan"
- Top-down view with internal walls and room labels

Respond with EXACTLY one word, all uppercase: YES or NO. No other text.`;

export interface PageClassification {
  pageNumber: number;
  isFloorPlan: boolean;
}

/**
 * Classify each page of a PDF in order. Returns the 1-indexed page number
 * of the FIRST page judged to be a floor plan, or null if none of the
 * inspected pages qualify.
 *
 * Also returns the rendered images of all inspected pages (low scale) so
 * the caller can avoid a second render pass for diagnostic logging.
 */
export async function findFloorPlanPage(
  pdfBuffer: Buffer,
): Promise<{
  pageNumber: number | null;
  classifications: PageClassification[];
  totalPagesRendered: number;
}> {
  // Render up to MAX_PAGES_TO_CLASSIFY pages at low scale.
  const allPages = await renderAllPdfPages(pdfBuffer, CLASSIFIER_SCALE);
  const pages = allPages.slice(0, MAX_PAGES_TO_CLASSIFY);

  if (pages.length === 0) {
    return { pageNumber: null, classifications: [], totalPagesRendered: 0 };
  }

  const anthropic = getClient();
  const classifications: PageClassification[] = [];

  for (let i = 0; i < pages.length; i++) {
    const pageNumber = i + 1;
    try {
      const response = await anthropic.messages.create({
        model: CLASSIFIER_MODEL,
        max_tokens: 5,
        system: CLASSIFIER_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/png",
                  data: pages[i],
                },
              },
              { type: "text", text: "Floor plan? Respond YES or NO." },
            ],
          },
        ],
      });
      const textBlock = response.content.find((b) => b.type === "text");
      const verdict =
        textBlock && textBlock.type === "text"
          ? textBlock.text.trim().toUpperCase()
          : "NO";
      const isFloorPlan = verdict.startsWith("YES");
      classifications.push({ pageNumber, isFloorPlan });
      if (isFloorPlan) {
        return {
          pageNumber,
          classifications,
          totalPagesRendered: pages.length,
        };
      }
    } catch (err) {
      console.error(
        `[page-classifier] page ${pageNumber} classify failed:`,
        err,
      );
      classifications.push({ pageNumber, isFloorPlan: false });
    }
  }

  return { pageNumber: null, classifications, totalPagesRendered: pages.length };
}
