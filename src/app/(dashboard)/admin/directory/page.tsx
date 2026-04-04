import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getDirectoryListings } from "./actions";
import { DirectoryAdminQueue } from "@/components/admin/directory-admin-queue";

export default async function AdminDirectoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!profile || (profile.role !== "owner" && profile.role !== "admin")) {
    redirect("/dashboard");
  }

  const listings = await getDirectoryListings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Directory Submissions</h1>
        <p className="text-muted-foreground">
          Review and approve public directory listing submissions
        </p>
      </div>
      <DirectoryAdminQueue listings={listings} />
    </div>
  );
}
