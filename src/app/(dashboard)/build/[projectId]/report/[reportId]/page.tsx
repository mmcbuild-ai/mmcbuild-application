import { redirect } from "next/navigation";
import Link from "next/link";
import { getDesignReport, getCachedPlanLayout } from "@/app/(dashboard)/build/actions";
import { DesignReport } from "@/components/build/design-report";
import { OptimisationProgress } from "@/components/build/optimisation-progress";
import { BuildExplorer3D } from "@/components/build/build-explorer-3d";
import type { SpatialLayout } from "@/lib/build/spatial/types";

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
    plan_id: string | null;
    status: string;
    summary: string | null;
    spatial_layout: SpatialLayout | null;
    completed_at: string | null;
  };

  // Fall back to a layout extracted by the build-page preview / test-3d (more
  // robust on CAD doc-sets) when the inline optimisation extractor returned
  // null — so the report's 3D doesn't silently disappear.
  const layout =
    check.spatial_layout ??
    (check.plan_id ? await getCachedPlanLayout(check.plan_id) : null);

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
    affected_wall_ids: string[] | null;
    affected_room_ids: string[] | null;
    decision: "undecided" | "pursuing" | "considering" | "rejected" | null;
    decision_note: string | null;
  }[];

  return (
    <div className="max-w-5xl space-y-6">
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
        <>
          {/* Existing text-based report */}
          <DesignReport check={check} suggestions={suggestions} />

          {/* 3D Build Explorer — System Explorer (4-system compare), Build
              Sequence storyboard, and Plan Comparison. Gated behind a click so
              the WebGL canvas only mounts when the user asks for it. Mapping IDs
              come from the AI optimisation step (SCRUM-161). */}
          {layout ? (
            <BuildExplorer3D
              layout={layout}
              suggestions={suggestions.map((s) => ({
                id: s.id,
                technology_category: s.technology_category,
                suggested_alternative: s.suggested_alternative,
                estimated_cost_savings: s.estimated_cost_savings,
                estimated_time_savings: s.estimated_time_savings,
                affected_wall_ids: s.affected_wall_ids ?? [],
                affected_room_ids: s.affected_room_ids ?? [],
              }))}
            />
          ) : (
            <div className="rounded-lg border bg-white px-4 py-3 text-sm text-zinc-600">
              <p className="font-medium text-zinc-900">3D view not available for this report</p>
              <p className="mt-1">
                We couldn&apos;t reconstruct a 3D model from this plan — this can
                happen with some CAD exports, or with reports run before the 3D
                viewer was added. Open the project&apos;s Build page and use{" "}
                <span className="font-medium">&ldquo;See your design built in the 4 MMC systems&rdquo;</span>{" "}
                to generate the 3D view, then re-run the optimisation.
              </p>
              <Link
                href={`/build/${projectId}`}
                className="mt-2 inline-block text-teal-600 hover:underline"
              >
                Go to the project Build page &rarr;
              </Link>
            </div>
          )}
        </>
      ) : (
        <OptimisationProgress
          checkId={reportId}
          initialStatus={check.status}
        />
      )}
    </div>
  );
}
