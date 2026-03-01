import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PlanDropzone } from "@/components/comply/plan-dropzone";
import { getProjectPlans } from "../../actions";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";

export default async function UploadPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .single();

  if (!project) {
    redirect("/comply");
  }

  const plans = await getProjectPlans(projectId);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href={`/comply/${projectId}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          &larr; Back to {project.name}
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Upload Building Plan</h1>
        <p className="text-muted-foreground">
          Upload a PDF of your building plans for compliance analysis
        </p>
      </div>

      <PlanDropzone projectId={projectId} />

      {plans.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold">Uploaded Plans</h2>
          <div className="space-y-2">
            {plans.map(
              (plan: {
                id: string;
                file_name: string;
                status: string;
                file_size_bytes: number;
                page_count: number | null;
              }) => (
                <div
                  key={plan.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{plan.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(plan.file_size_bytes / 1024 / 1024).toFixed(1)} MB
                        {plan.page_count && ` · ${plan.page_count} pages`}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      plan.status === "ready" ? "default" : "secondary"
                    }
                    className="text-xs capitalize"
                  >
                    {plan.status}
                  </Badge>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
