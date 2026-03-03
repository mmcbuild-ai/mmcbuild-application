/**
 * Pluggable rate adapter layer for ingesting cost rates from external sources.
 */

export interface RateRecord {
  category: string;
  element: string;
  unit: string;
  rate: number;
  state: string;
  source_detail?: string;
}

export interface RateAdapter {
  name: string;
  fetch(config: Record<string, unknown>): Promise<RateRecord[]>;
}

/** Manual rates — managed via SQL/admin UI, returns empty. */
const ManualAdapter: RateAdapter = {
  name: "manual",
  async fetch() {
    return [];
  },
};

/** CSV adapter — fetches and parses a CSV from a URL. */
const CsvAdapter: RateAdapter = {
  name: "csv",
  async fetch(config: Record<string, unknown>): Promise<RateRecord[]> {
    const url = config.url as string | undefined;
    if (!url) throw new Error("CsvAdapter requires a 'url' in config");

    const categoryCol = (config.category_column as string) ?? "category";
    const elementCol = (config.element_column as string) ?? "element";
    const unitCol = (config.unit_column as string) ?? "unit";
    const rateCol = (config.rate_column as string) ?? "rate";
    const stateCol = (config.state_column as string) ?? "state";
    const detailCol = (config.detail_column as string) ?? "source_detail";

    const response = await fetch(url);
    if (!response.ok) throw new Error(`CSV fetch failed: ${response.status}`);
    const text = await response.text();

    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    const colIndex = (name: string) => headers.indexOf(name);

    const records: RateRecord[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      const catIdx = colIndex(categoryCol);
      const elemIdx = colIndex(elementCol);
      const unitIdx = colIndex(unitCol);
      const rateIdx = colIndex(rateCol);
      const stateIdx = colIndex(stateCol);
      const detailIdx = colIndex(detailCol);

      if (catIdx < 0 || elemIdx < 0 || rateIdx < 0) continue;

      const rate = parseFloat(cols[rateIdx]);
      if (isNaN(rate)) continue;

      records.push({
        category: cols[catIdx],
        element: cols[elemIdx],
        unit: unitIdx >= 0 ? cols[unitIdx] : "each",
        rate,
        state: stateIdx >= 0 ? cols[stateIdx] : "NSW",
        source_detail: detailIdx >= 0 ? cols[detailIdx] || undefined : undefined,
      });
    }

    return records;
  },
};

/** API adapter — generic JSON API with configurable JSONPath mapping. */
const ApiAdapter: RateAdapter = {
  name: "api",
  async fetch(config: Record<string, unknown>): Promise<RateRecord[]> {
    const url = config.url as string | undefined;
    if (!url) throw new Error("ApiAdapter requires a 'url' in config");

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(config.headers as Record<string, string> | undefined),
    };

    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`API fetch failed: ${response.status}`);
    const json = await response.json();

    // Navigate to data array via a dot-separated path
    const dataPath = (config.data_path as string) ?? "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any[] = json;
    if (dataPath) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let current: any = json;
      for (const key of dataPath.split(".")) {
        current = current?.[key];
      }
      data = Array.isArray(current) ? current : [];
    }

    // Field mappings
    const mapping = (config.field_mapping as Record<string, string>) ?? {};
    const catField = mapping.category ?? "category";
    const elemField = mapping.element ?? "element";
    const unitField = mapping.unit ?? "unit";
    const rateField = mapping.rate ?? "rate";
    const stateField = mapping.state ?? "state";
    const detailField = mapping.source_detail ?? "source_detail";

    return data
      .map((item) => ({
        category: String(item[catField] ?? ""),
        element: String(item[elemField] ?? ""),
        unit: String(item[unitField] ?? "each"),
        rate: parseFloat(item[rateField]),
        state: String(item[stateField] ?? "NSW"),
        source_detail: item[detailField] ? String(item[detailField]) : undefined,
      }))
      .filter((r) => r.category && r.element && !isNaN(r.rate));
  },
};

/** Factory function to get the adapter for a given source type. */
export function getAdapter(sourceType: string): RateAdapter {
  switch (sourceType) {
    case "manual":
      return ManualAdapter;
    case "csv":
      return CsvAdapter;
    case "api":
      return ApiAdapter;
    default:
      throw new Error(`Unknown rate source type: ${sourceType}`);
  }
}

/** Simple CSV line parser that handles quoted fields. */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}
