import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getProjectContributors } from "../../actions";
import { ProjectContributors } from "@/components/comply/project-contributors";

export default async function TeamPage({
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

  const contributors = await getProjectContributors(projectId);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link
          href={`/comply/${projectId}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          &larr; Back to Project
        </Link>
        <h1 className="mt-2 text-2xl font-bold">
          {project.name} — Project Team
        </h1>
      </div>

      <ProjectContributors projectId={projectId} contributors={contributors} />
    </div>
  );
}
