"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SeverityBadge } from "./severity-badge";
import { ChevronDown, ChevronUp, ShieldCheck, AlertTriangle } from "lucide-react";
import { FindingFeedback } from "./finding-feedback";

interface FindingCardProps {
  finding: {
    id?: string;
    check_id?: string;
    ncc_section: string;
    category: string;
    title: string;
    description: string;
    recommendation: string | null;
    severity: "compliant" | "advisory" | "non_compliant" | "critical";
    confidence: number;
    ncc_citation: string | null;
    page_references: number[] | null;
    validation_tier?: number | null;
    agreement_score?: number | null;
    secondary_model?: string | null;
    was_reconciled?: boolean | null;
  };
}

export function FindingCard({ finding }: FindingCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="border-l-4" style={{
      borderLeftColor: finding.severity === "compliant" ? "#22c55e"
        : finding.severity === "advisory" ? "#eab308"
        : finding.severity === "critical" ? "#991b1b"
        : "#ef4444"
    }}>
      <CardHeader
        className="cursor-pointer pb-2"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-muted-foreground">
                {finding.ncc_section}
              </span>
              <SeverityBadge severity={finding.severity} />
              <ValidationBadge
                agreementScore={finding.agreement_score}
                wasReconciled={finding.was_reconciled}
                secondaryModel={finding.secondary_model}
              />
            </div>
            <CardTitle className="text-sm font-medium">{finding.title}</CardTitle>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Confidence</div>
              <div className="flex items-center gap-1">
                <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${finding.confidence * 100}%` }}
                  />
                </div>
                <span className="text-xs font-mono">
                  {Math.round(finding.confidence * 100)}%
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
        <CardContent className="pt-0 space-y-3">
          <p className="text-sm text-muted-foreground">{finding.description}</p>

          {finding.recommendation && (
            <div>
              <p className="text-xs font-medium mb-1">Recommendation</p>
              <p className="text-sm text-muted-foreground">{finding.recommendation}</p>
            </div>
          )}

          {finding.ncc_citation && (
            <div>
              <p className="text-xs font-medium mb-1">NCC Citation</p>
              <p className="text-sm font-mono text-muted-foreground text-xs">
                {finding.ncc_citation}
              </p>
            </div>
          )}

          {finding.page_references && finding.page_references.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-1">Plan Pages</p>
              <p className="text-sm text-muted-foreground">
                {finding.page_references.join(", ")}
              </p>
            </div>
          )}

          {finding.agreement_score != null && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground">
                Cross-validated ({finding.secondary_model ?? "secondary model"})
                {" · "}Agreement: {Math.round(finding.agreement_score * 100)}%
                {finding.was_reconciled && " · Reconciled"}
              </p>
            </div>
          )}

          {finding.id && finding.check_id && (
            <div className="pt-2 border-t flex justify-end">
              <FindingFeedback
                findingId={finding.id}
                checkId={finding.check_id}
                currentSeverity={finding.severity}
              />
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function ValidationBadge({
  agreementScore,
  wasReconciled,
  secondaryModel,
}: {
  agreementScore?: number | null;
  wasReconciled?: boolean | null;
  secondaryModel?: string | null;
}) {
  if (!secondaryModel) return null;

  if (wasReconciled) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
        <AlertTriangle className="h-2.5 w-2.5" />
        Reconciled
      </span>
    );
  }

  if (agreementScore != null && agreementScore >= 0.8) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
        <ShieldCheck className="h-2.5 w-2.5" />
        Consensus
      </span>
    );
  }

  return null;
}
