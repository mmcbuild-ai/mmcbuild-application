import { redirect } from "next/navigation";
import Link from "next/link";
import { getDesignReport } from "@/app/(dashboard)/build/actions";
import { DesignReport } from "@/components/build/design-report";
import { OptimisationProgress } from "@/components/build/optimisation-progress";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ projectId: string; reportId: string }>;
}) {
  const { projectId, reportId } = await params;

  const result = await getDesignReport(reportId);

  if (result.error || !result.check) {
    redirect(`/build/${projectId}`);
  }

  const check = result.check as unknown as {
    id: string;
    project_id: string;
    status: string;
    summary: string | null;
    completed_at: string | null;
  };

  const suggestions = (result.suggestions ?? []) as unknown as {
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
    sort_order: number;
  }[];

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link
          href={`/build/${projectId}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          &larr; Back to Project
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Design Optimisation Report</h1>
      </div>

      {check.status === "completed" ? (
        <DesignReport check={check} suggestions={suggestions} />
      ) : (
        <OptimisationProgress
          checkId={reportId}
          initialStatus={check.status}
        />
      )}
    </div>
  );
}
