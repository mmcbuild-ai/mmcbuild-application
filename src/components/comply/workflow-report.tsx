"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FindingReviewCard } from "./finding-review-card";
import { DisciplineBadge } from "./project-contributors";
import { DISCIPLINE_LABELS, type ContributorDiscipline } from "@/lib/ai/types";
import { Send } from "lucide-react";
import { bulkSendFindings } from "@/app/(dashboard)/comply/actions";
import { useRouter } from "next/navigation";

interface ReviewFinding {
  id: string;
  ncc_section: string;
  category: string;
  title: string;
  description: string;
  recommendation: string | null;
  severity: "compliant" | "advisory" | "non_compliant" | "critical";
  confidence: number;
  ncc_citation: string | null;
  page_references: number[] | null;
  responsible_discipline: string | null;
  assigned_contributor_id: string | null;
  remediation_action: string | null;
  review_status: string | null;
  rejection_reason: string | null;
  amended_description: string | null;
  amended_action: string | null;
  amended_discipline: string | null;
  sent_at: string | null;
}

interface Contributor {
  id: string;
  discipline: string;
  contact_name: string;
  company_name: string | null;
  contact_email: string | null;
}

interface WorkflowReportProps {
  findings: ReviewFinding[];
  contributors: Contributor[];
}

export function WorkflowReport({
  findings,
  contributors,
}: WorkflowReportProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Group findings by effective discipline
  const grouped = new Map<string, ReviewFinding[]>();
  for (const f of findings) {
    const disc = f.amended_discipline ?? f.responsible_discipline ?? "other";
    const existing = grouped.get(disc) ?? [];
    existing.push(f);
    grouped.set(disc, existing);
  }

  // Sort disciplines by number of findings (descending)
  const sortedDisciplines = [...grouped.entries()].sort(
    (a, b) => b[1].length - a[1].length
  );

  // Stats
  const total = findings.length;
  const reviewed = findings.filter(
    (f) =>
      f.review_status === "accepted" ||
      f.review_status === "amended" ||
      f.review_status === "rejected" ||
      f.review_status === "sent"
  ).length;
  const sendable = findings.filter(
    (f) =>
      f.review_status === "accepted" || f.review_status === "amended"
  );

  function handleBulkSend() {
    if (sendable.length === 0) return;
    startTransition(async () => {
      await bulkSendFindings(sendable.map((f) => f.id));
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Progress summary */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {reviewed} of {total} findings reviewed
              </p>
              <div className="h-2 w-64 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: total > 0 ? `${(reviewed / total) * 100}%` : "0%",
                  }}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <StatusCount
                label="Pending"
                count={
                  findings.filter((f) => f.review_status === "pending").length
                }
                color="bg-yellow-100 text-yellow-800"
              />
              <StatusCount
                label="Accepted"
                count={
                  findings.filter((f) => f.review_status === "accepted").length
                }
                color="bg-green-100 text-green-800"
              />
              <StatusCount
                label="Amended"
                count={
                  findings.filter((f) => f.review_status === "amended").length
                }
                color="bg-blue-100 text-blue-800"
              />
              <StatusCount
                label="Rejected"
                count={
                  findings.filter((f) => f.review_status === "rejected").length
                }
                color="bg-gray-100 text-gray-800"
              />
              <StatusCount
                label="Sent"
                count={
                  findings.filter((f) => f.review_status === "sent").length
                }
                color="bg-purple-100 text-purple-800"
              />
            </div>
          </div>

          {sendable.length > 0 && (
            <div className="mt-3 pt-3 border-t flex justify-end">
              <Button
                size="sm"
                onClick={handleBulkSend}
                disabled={isPending}
              >
                <Send className="mr-2 h-3.5 w-3.5" />
                Mark All Accepted as Sent ({sendable.length})
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Findings grouped by discipline */}
      {sortedDisciplines.map(([discipline, discFindings]) => (
        <div key={discipline} className="space-y-3">
          <div className="flex items-center gap-2">
            <DisciplineBadge discipline={discipline} />
            <span className="text-sm text-muted-foreground">
              ({discFindings.length} item{discFindings.length !== 1 ? "s" : ""})
            </span>
          </div>
          <div className="space-y-3">
            {discFindings.map((finding) => (
              <FindingReviewCard
                key={finding.id}
                finding={finding}
                contributors={contributors.filter(
                  (c) => c.discipline === discipline || c.discipline === "other"
                )}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusCount({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  if (count === 0) return null;
  return (
    <Badge variant="secondary" className={`text-xs ${color}`}>
      {label}: {count}
    </Badge>
  );
}
