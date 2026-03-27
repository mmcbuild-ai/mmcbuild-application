/**
 * Piece 2: AI Vision Spatial Extraction
 *
 * Sends a floor plan image to Claude Vision and extracts structured spatial data
 * (walls, rooms, doors, windows with coordinates).
 *
 * This is the core R&D component — genuine technical uncertainty about whether
 * an LLM can accurately parse architectural floor plans into spatial coordinates.
 *
 * Note: Uses the Anthropic SDK directly (not via callModel) because vision
 * requires multi-part message content which the current router doesn't support.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { SpatialLayout } from "./types";

const SPATIAL_EXTRACTION_PROMPT = `You are an architectural plan analyser. Extract all spatial elements from this floor plan image as structured JSON.

INSTRUCTIONS:
1. Identify all rooms and their approximate boundaries as polygons (coordinates in metres from the bottom-left corner of the plan)
2. Identify all walls with start/end points and classify as external, internal, or party walls
3. Identify all openings (doors, windows, bifold doors, sliding doors, garage doors) with position and dimensions
4. Estimate the overall dimensions of the building footprint
5. If dimensions are annotated on the plan, use those. Otherwise estimate from proportions.
6. Use a consistent coordinate system with (0,0) at the bottom-left corner of the building footprint.

OUTPUT FORMAT — return ONLY valid JSON matching this schema:
{
  "rooms": [
    { "id": "r1", "name": "Living", "polygon": [{"x":0,"y":0},{"x":6,"y":0},{"x":6,"y":4},{"x":0,"y":4}], "area_m2": 24, "floor_level": 0, "type": "living" }
  ],
  "walls": [
    { "id": "w1", "start": {"x":0,"y":0}, "end": {"x":6,"y":0}, "thickness": 0.09, "type": "external", "material": "timber_frame" }
  ],
  "openings": [
    { "id": "o1", "type": "door", "position": {"x":3,"y":0}, "width": 0.82, "height": 2.04, "wall_id": "w1" },
    { "id": "o2", "type": "window", "position": {"x":1.5,"y":4}, "width": 1.2, "height": 1.2, "wall_id": "w3", "sill_height": 0.9 }
  ],
  "bounds": { "min": {"x":0,"y":0}, "max": {"x":12,"y":10}, "width": 12, "depth": 10 },
  "storeys": 1,
  "wall_height": 2.4,
  "confidence": 0.85,
  "notes": "Dimensions estimated from room labels. Garage wall thickness assumed 0.2m."
}

GUIDELINES:
- Use metric units (metres) for all dimensions
- Standard Australian residential wall heights: 2.4m (ground), 2.7m (if specified)
- Standard stud wall thickness: 0.09m (internal), 0.11m (external with cladding)
- Brick veneer: 0.27m total, double brick: 0.25m
- If you cannot determine exact coordinates, provide your best estimate and lower the confidence score
- Room types: living, bedroom, bathroom, kitchen, laundry, garage, hallway, entry, study, dining, ensuite, wir (walk-in-robe), pantry, alfresco, porch
- Wall materials if identifiable: timber_frame, brick_veneer, double_brick, hebel, sip_panel, clt, steel_frame`;

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  return client;
}

/**
 * Extract spatial layout from a floor plan image using Claude Vision.
 *
 * @param imageBase64 - Base64-encoded floor plan image (PNG/JPG)
 * @param mediaType - MIME type of the image
 * @param context - Optional context from questionnaire (e.g. building class, dimensions)
 * @returns Structured spatial layout or null if extraction fails
 */
export async function extractSpatialLayout(
  imageBase64: string,
  mediaType: "image/png" | "image/jpeg" = "image/png",
  context?: string
): Promise<SpatialLayout | null> {
  const contextBlock = context
    ? `\n\nADDITIONAL CONTEXT FROM QUESTIONNAIRE:\n${context}`
    : "";

  try {
    const anthropic = getClient();

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      system: SPATIAL_EXTRACTION_PROMPT + contextBlock,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: "Extract all spatial elements from this floor plan. Return only the JSON structure.",
            },
          ],
        },
      ],
    });

    // Extract text from response
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      console.error("Spatial extraction: no text response");
      return null;
    }

    // Parse the JSON response — handle markdown code fences
    let jsonStr = textBlock.text.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(jsonStr) as SpatialLayout;

    // Basic validation
    if (!parsed.rooms || !parsed.walls || !parsed.bounds) {
      console.error("Spatial extraction: missing required fields");
      return null;
    }

    return parsed;
  } catch (error) {
    console.error("Spatial extraction failed:", error);
    return null;
  }
}
