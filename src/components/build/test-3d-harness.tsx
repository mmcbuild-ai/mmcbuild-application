"use client";

import { useState } from "react";
import { Loader2, FileText, Image as ImageIcon } from "lucide-react";
import { PlanComparison3D } from "./plan-comparison-3d";
import {
  extractTest3D,
  type Test3DResult,
} from "@/app/(dashboard)/build/test-3d/actions";
import { Button } from "@/components/ui/button";

export function Test3DHarness() {
  const [file, setFile] = useState<File | null>(null);
  const [page, setPage] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Test3DResult | null>(null);
  const [showJson, setShowJson] = useState(false);

  const isPdf = file?.type === "application/pdf";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (page.trim()) formData.append("page", page.trim());
      const res = await extractTest3D(formData);
      setResult(res);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setFile(null);
    setPage("");
    setResult(null);
    setShowJson(false);
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="rounded-lg border bg-white p-4 space-y-4"
      >
        <div>
          <label className="block text-sm font-medium mb-1">
            Plan file (PDF, PNG, or JPG)
          </label>
          <input
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setResult(null);
            }}
            className="block w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm hover:file:bg-zinc-200"
          />
          {file && (
            <p className="mt-2 flex items-center gap-2 text-xs text-zinc-600">
              {isPdf ? (
                <FileText className="h-3.5 w-3.5" />
              ) : (
                <ImageIcon className="h-3.5 w-3.5" />
              )}
              <span>
                {file.name} · {(file.size / 1024).toFixed(0)} KB ·{" "}
                {file.type || "unknown type"}
              </span>
            </p>
          )}
        </div>

        {isPdf && (
          <div>
            <label className="block text-sm font-medium mb-1">
              PDF page (blank = auto-detect floor plan page)
            </label>
            <input
              type="number"
              min={1}
              value={page}
              onChange={(e) => setPage(e.target.value)}
              placeholder="auto"
              className="w-32 rounded border px-2 py-1 text-sm"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Auto-detect uses Haiku to scan up to the first 15 pages and pick
              the first floor plan it finds.
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={!file || loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Extracting…
              </>
            ) : (
              "Extract & Render"
            )}
          </Button>
          {(file || result) && (
            <Button type="button" variant="outline" onClick={reset}>
              Reset
            </Button>
          )}
        </div>
      </form>

      {result?.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <strong className="block mb-1">Extraction failed</strong>
          {result.error}
        </div>
      )}

      {result && !result.error && !result.layout && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Extractor returned no layout. The image may not be a recognisable
          floor plan, or the AI couldn&apos;t parse it. Check server logs for
          details.
        </div>
      )}

      {result?.layout && (
        <>
          {result.detectedPage != null && (
            <p className="text-xs text-zinc-600">
              Auto-detected floor plan on page {result.detectedPage} (inspected{" "}
              {result.totalPagesInspected} pages).
            </p>
          )}
          {result.pageUsed != null && result.detectedPage == null && (
            <p className="text-xs text-zinc-600">
              Used PDF page {result.pageUsed}.
            </p>
          )}

          <div className="rounded-lg border bg-white p-4">
            <h2 className="mb-3 text-lg font-semibold">3D render</h2>
            <PlanComparison3D layout={result.layout} suggestions={[]} />
          </div>

          <div className="rounded-lg border bg-white">
            <button
              type="button"
              onClick={() => setShowJson((v) => !v)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-left hover:bg-zinc-50 rounded-lg"
            >
              <span>
                {showJson ? "Hide" : "Show"} extracted JSON
              </span>
              <span className="text-xs font-normal text-zinc-500">
                {result.layout.walls.length} walls ·{" "}
                {result.layout.rooms.length} rooms ·{" "}
                {result.layout.openings?.length ?? 0} openings · confidence{" "}
                {Math.round((result.layout.confidence ?? 0) * 100)}%
              </span>
            </button>
            {showJson && (
              <pre className="border-t bg-zinc-50 p-4 text-xs overflow-auto max-h-96">
                {JSON.stringify(result.layout, null, 2)}
              </pre>
            )}
          </div>
        </>
      )}
    </div>
  );
}
