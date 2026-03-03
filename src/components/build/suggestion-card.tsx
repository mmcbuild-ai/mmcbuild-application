"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronUp, ArrowRight } from "lucide-react";
import {
  getTechnologyLabel,
  COMPLEXITY_LABELS,
  COMPLEXITY_COLOURS,
  type ImplementationComplexity,
} from "@/lib/ai/types";

interface SuggestionCardProps {
  suggestion: {
    id: string;
    technology_category: string;
    current_approach: string;
    suggested_alternative: string;
    benefits: string;
    estimated_time_savings: number | null;
    estimated_cost_savings: number | null;
    estimated_waste_reduction: number | null;
    implementation_complexity: string;
    confidence: number;
  };
}

export function SuggestionCard({ suggestion }: SuggestionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const complexity = suggestion.implementation_complexity as ImplementationComplexity;

  return (
    <Card className="border-l-4 border-l-teal-500">
      <CardHeader
        className="cursor-pointer pb-2"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
                {getTechnologyLabel(suggestion.technology_category)}
              </span>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${COMPLEXITY_COLOURS[complexity] ?? "bg-gray-100 text-gray-700"}`}
              >
                {COMPLEXITY_LABELS[complexity] ?? complexity}
              </span>
            </div>
            <CardTitle className="text-sm font-medium">
              {suggestion.suggested_alternative}
            </CardTitle>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Confidence</div>
              <div className="flex items-center gap-1">
                <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-teal-500"
                    style={{ width: `${suggestion.confidence * 100}%` }}
                  />
                </div>
                <span className="text-xs font-mono">
                  {Math.round(suggestion.confidence * 100)}%
                </span>
              </div>
            </div>
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-4">
          {/* Before / After */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border bg-red-50 p-3">
              <p className="text-xs font-semibold text-red-700 mb-1">Current Approach</p>
              <p className="text-sm text-red-900">{suggestion.current_approach}</p>
            </div>
            <div className="rounded-md border bg-teal-50 p-3">
              <p className="text-xs font-semibold text-teal-700 mb-1">Suggested Alternative</p>
              <p className="text-sm text-teal-900">{suggestion.suggested_alternative}</p>
            </div>
          </div>

          {/* Arrow between cards on mobile */}
          <div className="flex justify-center sm:hidden -my-2">
            <ArrowRight className="h-5 w-5 text-teal-500 rotate-90" />
          </div>

          {/* Benefits */}
          <div>
            <p className="text-xs font-medium mb-1">Benefits</p>
            <p className="text-sm text-muted-foreground">{suggestion.benefits}</p>
          </div>

          {/* Savings estimates */}
          <div className="grid grid-cols-3 gap-3">
            <SavingsStat
              label="Time Savings"
              value={suggestion.estimated_time_savings}
            />
            <SavingsStat
              label="Cost Savings"
              value={suggestion.estimated_cost_savings}
            />
            <SavingsStat
              label="Waste Reduction"
              value={suggestion.estimated_waste_reduction}
            />
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function SavingsStat({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  const pct = value ?? 0;
  return (
    <div className="text-center rounded-md border p-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold text-teal-700">
        {pct > 0 ? `-${pct}%` : "—"}
      </p>
    </div>
  );
}
