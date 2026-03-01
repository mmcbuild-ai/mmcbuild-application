import { redirect } from "next/navigation";
import Link from "next/link";
import { getComplianceReport } from "../../../actions";
import { ComplianceReport } from "@/components/comply/compliance-report";
import { CheckProgress } from "@/components/comply/check-progress";

export default async function CheckPage({
  params,
}: {
  params: Promise<{ projectId: string; checkId: string }>;
}) {
  const { projectId, checkId } = await params;

  const result = await getComplianceReport(checkId);

  if (result.error || !result.check) {
    redirect(`/comply/${projectId}`);
  }

  const check = result.check as {
    id: string;
    status: string;
    summary: string | null;
    overall_risk: "low" | "medium" | "high" | "critical" | null;
    completed_at: string | null;
  };

  const findings = (result.findings ?? []) as {
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
    sort_order: number;
  }[];

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link
          href={`/comply/${projectId}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          &larr; Back to Project
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Compliance Report</h1>
      </div>

      {check.status === "completed" ? (
        <ComplianceReport check={check} findings={findings} />
      ) : (
        <CheckProgress
          checkId={checkId}
          initialStatus={check.status}
        />
      )}
    </div>
  );
}
