"use client";

import { useState } from "react";
import { RateBrowser } from "./rate-browser";
import { CsvUpload } from "./csv-upload";
import { RateSourceCard } from "@/components/settings/rate-source-card";
import { NewRateSourceForm } from "@/components/settings/new-rate-source-form";

interface Source {
  id: string;
  name: string;
  source_type: string;
  config: Record<string, unknown>;
  last_synced_at: string | null;
  is_active: boolean;
  created_at: string;
}

interface CostRatesAdminProps {
  sources: Source[];
  sourceRateCounts: Record<string, number>;
  categories: string[];
}

const TABS = [
  { id: "browser", label: "Rate Browser" },
  { id: "upload", label: "Upload CSV" },
  { id: "sources", label: "Data Sources" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function CostRatesAdmin({
  sources,
  sourceRateCounts,
  categories,
}: CostRatesAdminProps) {
  const [tab, setTab] = useState<TabId>("browser");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Cost Rate Management</h1>
        <p className="text-sm text-muted-foreground">
          View, edit, and upload construction cost rates. Your overrides take
          priority over default rates in cost estimates.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "browser" && <RateBrowser categories={categories} />}

      {tab === "upload" && <CsvUpload />}

      {tab === "sources" && (
        <div className="space-y-6">
          <div className="space-y-3">
            {sources.map((source) => (
              <div key={source.id}>
                <RateSourceCard source={source} />
                <p className="text-xs text-muted-foreground mt-1 ml-1">
                  {sourceRateCounts[source.id] ?? 0} reference rate
                  {(sourceRateCounts[source.id] ?? 0) !== 1 ? "s" : ""}
                </p>
              </div>
            ))}
            {sources.length === 0 && (
              <div className="rounded-md border p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No rate sources configured yet.
                </p>
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-white p-4">
            <h2 className="text-sm font-semibold mb-3">Add Rate Source</h2>
            <NewRateSourceForm />
          </div>
        </div>
      )}
    </div>
  );
}
