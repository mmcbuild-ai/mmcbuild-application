"use client";

import { useState, useTransition, useCallback } from "react";
import { Upload, FileSpreadsheet, AlertCircle, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { bulkUpsertOrgOverrides } from "./actions";

type ParsedRow = {
  category: string;
  element: string;
  unit: string;
  base_rate: number;
  state: string;
  year?: number;
  notes?: string;
};

type ParseError = { row: number; message: string };

function parseCSV(text: string): { rows: ParsedRow[]; errors: ParseError[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    return { rows: [], errors: [{ row: 0, message: "CSV must have a header row and at least one data row" }] };
  }

  const headerLine = lines[0].toLowerCase();
  const headers = headerLine.split(",").map((h) => h.trim().replace(/^"/, "").replace(/"$/, ""));

  // Map known column names
  const colMap = {
    category: headers.findIndex((h) => ["category", "cost_category", "trade"].includes(h)),
    element: headers.findIndex((h) => ["element", "description", "item", "element_description"].includes(h)),
    unit: headers.findIndex((h) => ["unit", "uom", "unit_of_measure"].includes(h)),
    rate: headers.findIndex((h) => ["rate", "base_rate", "unit_rate", "price", "cost"].includes(h)),
    state: headers.findIndex((h) => ["state", "region"].includes(h)),
    year: headers.findIndex((h) => ["year"].includes(h)),
    notes: headers.findIndex((h) => ["notes", "source", "reference", "comment"].includes(h)),
  };

  if (colMap.category === -1 || colMap.element === -1 || colMap.rate === -1) {
    return {
      rows: [],
      errors: [{
        row: 0,
        message: `Missing required columns. Found: [${headers.join(", ")}]. Need: category, element, rate (or equivalent names).`,
      }],
    };
  }

  const rows: ParsedRow[] = [];
  const errors: ParseError[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    const category = cells[colMap.category]?.trim();
    const element = cells[colMap.element]?.trim();
    const rateStr = cells[colMap.rate]?.trim().replace(/[$,]/g, "");
    const rate = parseFloat(rateStr);

    if (!category || !element) {
      errors.push({ row: i + 1, message: "Missing category or element" });
      continue;
    }
    if (isNaN(rate) || rate < 0) {
      errors.push({ row: i + 1, message: `Invalid rate "${cells[colMap.rate]}" for ${element}` });
      continue;
    }

    rows.push({
      category: category.toLowerCase().replace(/\s+/g, "_"),
      element,
      unit: colMap.unit >= 0 ? cells[colMap.unit]?.trim() || "each" : "each",
      base_rate: rate,
      state: colMap.state >= 0 ? cells[colMap.state]?.trim().toUpperCase() || "NSW" : "NSW",
      year: colMap.year >= 0 ? parseInt(cells[colMap.year]) || 2025 : 2025,
      notes: colMap.notes >= 0 ? cells[colMap.notes]?.trim() || undefined : undefined,
    });
  }

  return { rows, errors };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export function CsvUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParsedRow[] | null>(null);
  const [errors, setErrors] = useState<ParseError[]>([]);
  const [isPending, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { rows, errors: parseErrors } = parseCSV(text);
      setPreview(rows);
      setErrors(parseErrors);
    };
    reader.readAsText(f);
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith(".csv") || f.type === "text/csv")) {
      handleFile(f);
    } else {
      toast.error("Please upload a .csv file");
    }
  }

  function handleImport() {
    if (!preview || preview.length === 0) return;

    startTransition(async () => {
      try {
        const result = await bulkUpsertOrgOverrides(preview);
        toast.success(`${result.imported} rates imported as overrides`);
        setFile(null);
        setPreview(null);
        setErrors([]);
      } catch (err) {
        toast.error("Import failed: " + (err instanceof Error ? err.message : "Unknown error"));
      }
    });
  }

  // Group preview by category for display
  const previewGrouped = preview
    ? preview.reduce((acc, r) => {
        if (!acc[r.category]) acc[r.category] = [];
        acc[r.category].push(r);
        return acc;
      }, {} as Record<string, ParsedRow[]>)
    : {};

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-slate-50/50 p-6">
        <h2 className="text-sm font-semibold mb-2">Upload Your Cost Rates</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Upload a CSV file with your own construction cost rates. These will be
          saved as overrides and take priority over the default rates in all
          future cost estimates.
        </p>

        {/* Expected format */}
        <div className="rounded-md bg-white border p-4 mb-4">
          <h3 className="text-xs font-semibold text-muted-foreground mb-2">
            Expected CSV Format
          </h3>
          <code className="text-xs text-muted-foreground block leading-relaxed">
            category,element,unit,rate,state,notes<br />
            frame,Timber wall frame supply &amp; erect,sqm_wall,95,NSW,Rawlinsons 2025<br />
            plumbing,Rough-in plumbing (per fixture point),each,900,QLD,Local supplier quote
          </code>
          <p className="text-xs text-muted-foreground mt-2">
            Required columns: <strong>category</strong>, <strong>element</strong>, <strong>rate</strong>.
            Optional: unit (defaults to &quot;each&quot;), state (defaults to NSW), year, notes.
          </p>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragOver ? "border-primary bg-primary/5" : "border-slate-300"
          }`}
        >
          <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Drag & drop a CSV file here, or{" "}
            <label className="text-primary hover:underline cursor-pointer">
              browse
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </label>
          </p>
        </div>
      </div>

      {/* Parse errors */}
      {errors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-red-800">
                {errors.length} row{errors.length !== 1 ? "s" : ""} with errors
              </h3>
              <ul className="mt-1 space-y-0.5">
                {errors.slice(0, 10).map((e, i) => (
                  <li key={i} className="text-xs text-red-700">
                    Row {e.row}: {e.message}
                  </li>
                ))}
                {errors.length > 10 && (
                  <li className="text-xs text-red-600">
                    ...and {errors.length - 10} more
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Preview */}
      {preview && preview.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{file?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {preview.length} rate{preview.length !== 1 ? "s" : ""} ready to import across{" "}
                  {Object.keys(previewGrouped).length} categories
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFile(null);
                  setPreview(null);
                  setErrors([]);
                }}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleImport} disabled={isPending}>
                <Check className="h-3.5 w-3.5 mr-1" />
                {isPending ? "Importing..." : `Import ${preview.length} Rates`}
              </Button>
            </div>
          </div>

          {/* Preview table */}
          <div className="rounded-lg border overflow-hidden max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0">
                <tr className="bg-slate-50 text-left">
                  <th className="px-3 py-2 font-medium text-muted-foreground">Category</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Element</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Unit</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground text-right">Rate</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">State</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Notes</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 100).map((row, i) => (
                  <tr key={i} className="border-t hover:bg-slate-50">
                    <td className="px-3 py-1.5 text-muted-foreground capitalize">
                      {row.category.replace(/_/g, " ")}
                    </td>
                    <td className="px-3 py-1.5">{row.element}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{row.unit}</td>
                    <td className="px-3 py-1.5 text-right font-medium">
                      ${row.base_rate.toLocaleString("en-AU")}
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">{row.state}</td>
                    <td className="px-3 py-1.5 text-xs text-muted-foreground">{row.notes ?? ""}</td>
                  </tr>
                ))}
                {preview.length > 100 && (
                  <tr className="border-t">
                    <td colSpan={6} className="px-3 py-2 text-center text-xs text-muted-foreground">
                      Showing first 100 of {preview.length} rows
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
