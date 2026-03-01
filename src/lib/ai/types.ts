export interface ComplianceFinding {
  ncc_section: string;
  category: string;
  title: string;
  description: string;
  recommendation: string;
  severity: "compliant" | "advisory" | "non_compliant" | "critical";
  confidence: number;
  ncc_citation: string;
  page_references: number[];
}

export interface ComplianceSectionResult {
  category: string;
  findings: ComplianceFinding[];
}

export interface ComplianceReport {
  summary: string;
  overall_risk: "low" | "medium" | "high" | "critical";
  sections: ComplianceSectionResult[];
  disclaimer: string;
}

export interface EmbeddingResult {
  embedding: number[];
  tokens_used: number;
}

export interface DocumentChunk {
  content: string;
  metadata: Record<string, unknown>;
  chunk_index: number;
}

export interface RetrievedDocument {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  source_type: string;
  source_id: string;
  chunk_index: number;
  similarity: number;
}

export type NccCategory =
  | "fire_safety"
  | "structural"
  | "energy_efficiency"
  | "accessibility"
  | "waterproofing"
  | "ventilation"
  | "glazing"
  | "termite"
  | "bushfire";

export const NCC_CATEGORIES: { key: NccCategory; label: string }[] = [
  { key: "fire_safety", label: "Fire Safety" },
  { key: "structural", label: "Structural" },
  { key: "energy_efficiency", label: "Energy Efficiency" },
  { key: "accessibility", label: "Accessibility" },
  { key: "waterproofing", label: "Waterproofing" },
  { key: "ventilation", label: "Ventilation" },
  { key: "glazing", label: "Glazing" },
  { key: "termite", label: "Termite Management" },
  { key: "bushfire", label: "Bushfire" },
];
