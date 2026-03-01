import type { NccCategory } from "../types";

const SECTION_PROMPTS: Record<NccCategory, string> = {
  fire_safety: `Analyse the building plan and project details for FIRE SAFETY compliance under NCC Volume Two (Housing Provisions).

Focus on:
- Part 3.7 Fire safety (fire separation, fire resistance levels)
- Smoke alarm requirements (AS 3786)
- Fire separation between dwellings and garage
- Protection of openings
- Bushfire construction requirements if applicable (AS 3959)

Consider the building classification and construction type when determining applicable requirements.`,

  structural: `Analyse the building plan and project details for STRUCTURAL compliance under NCC Volume Two.

Focus on:
- Part 3.4 Footings and slabs (soil classification, footing design)
- Part 3.5 Masonry (if applicable)
- Part 3.6 Framing (timber/steel framing, bracing, tie-down)
- Wind classification and load paths
- Earthquake design considerations (if applicable)
- Foundation adequacy for site conditions`,

  energy_efficiency: `Analyse the building plan and project details for ENERGY EFFICIENCY compliance under NCC Volume Two.

Focus on:
- Part 13 Energy Efficiency (NCC 2022+) or Part 3.12 (pre-2022)
- Thermal performance requirements for the climate zone
- Insulation requirements (walls, ceiling, floor)
- Glazing requirements (U-value, SHGC for the climate zone)
- Building sealing and air leakage
- Services energy efficiency (water heating, lighting, HVAC)
- Whole-of-home energy rating (NatHERS if applicable)`,

  accessibility: `Analyse the building plan and project details for ACCESSIBILITY provisions under NCC Volume Two.

Focus on:
- Accessible housing provisions (if applicable under state requirements)
- Livable Housing Design Guidelines alignment
- Entry access (step-free entry if required)
- Internal circulation (corridors, doorways)
- Bathroom and toilet accessibility
- Note: Class 1a dwellings have limited mandatory accessibility requirements under NCC but some states require additional provisions`,

  waterproofing: `Analyse the building plan and project details for WATERPROOFING compliance under NCC Volume Two.

Focus on:
- Part 3.8 Wet areas (AS 3740 compliance)
- Waterproofing to bathrooms, laundries, and other wet areas
- Shower waterproofing requirements
- External waterproofing and damp-proofing
- Balcony and deck waterproofing
- Sub-floor ventilation and moisture management`,

  ventilation: `Analyse the building plan and project details for VENTILATION compliance under NCC Volume Two.

Focus on:
- Part 3.8.5 Ventilation of rooms
- Natural ventilation requirements (openable window area)
- Mechanical ventilation for bathrooms and laundries
- Sub-floor ventilation requirements
- Kitchen exhaust requirements
- Habitable room ventilation openings (minimum 5% of floor area)`,

  glazing: `Analyse the building plan and project details for GLAZING compliance under NCC Volume Two.

Focus on:
- Part 3.6 Glazing (AS 1288)
- Safety glazing requirements (human impact areas)
- Glazing in hazardous locations (doors, sidelights, low-level glazing)
- Balustrade glazing requirements
- Energy efficiency glazing requirements for the climate zone`,

  termite: `Analyse the building plan and project details for TERMITE MANAGEMENT compliance under NCC Volume Two.

Focus on:
- Part 3.1.3 Termite risk management
- AS 3660.1 Termite management — new building work
- Termite management systems (physical barriers, chemical treatment)
- Slab edge exposure requirements
- Inspection access requirements
- Termite risk zone applicability`,

  bushfire: `Analyse the building plan and project details for BUSHFIRE compliance under NCC Volume Two.

Focus on:
- AS 3959 Construction of buildings in bushfire-prone areas
- Applicable BAL (Bushfire Attack Level) requirements
- External wall construction for the assigned BAL
- Roof construction and sarking requirements
- Window and glazing requirements for BAL rating
- Decking and subfloor enclosure
- Water supply and access requirements

Note: Only applicable if BAL rating is BAL-LOW or higher. If BAL is N/A or BAL-LOW, note that standard construction is acceptable.`,
};

export function getSectionPrompt(category: NccCategory): string {
  return SECTION_PROMPTS[category];
}

export const SECTION_ANALYSIS_TEMPLATE = (
  category: NccCategory,
  planContent: string,
  projectContext: string,
  nccContext: string
) => `${SECTION_PROMPTS[category]}

${projectContext}

RELEVANT PLAN EXTRACTS:
${planContent || "No specific plan text available for this section."}

RELEVANT NCC REFERENCE MATERIAL:
${nccContext || "No specific NCC reference material available. Use your knowledge of the NCC."}

Respond with a JSON object matching this schema:
{
  "category": "${category}",
  "findings": [
    {
      "ncc_section": "string — NCC clause number (e.g. '3.7.1.1' or 'H1P1')",
      "category": "${category}",
      "title": "string — short title for the finding",
      "description": "string — detailed description of the compliance issue or confirmation",
      "recommendation": "string — specific recommendation or next steps",
      "severity": "compliant | advisory | non_compliant | critical",
      "confidence": 0.0-1.0,
      "ncc_citation": "string — full NCC citation text",
      "page_references": [1, 2]
    }
  ]
}

Return ONLY valid JSON, no other text.`;
