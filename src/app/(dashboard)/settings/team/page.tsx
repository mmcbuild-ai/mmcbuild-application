import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { getOrgContributorDirectory } from "./actions";
import { TeamDirectoryTable } from "./team-directory-table";

export default async function TeamDirectoryPage() {
  const entries = await getOrgContributorDirectory();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/settings"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Link>
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Team Directory</h1>
        </div>
        <p className="text-muted-foreground">
          Everyone added as a contributor to any project in your organisation.
          Edit details once to update across all projects, or remove someone
          from every project at once.
        </p>
      </div>

      <TeamDirectoryTable entries={entries} />
    </div>
  );
}
