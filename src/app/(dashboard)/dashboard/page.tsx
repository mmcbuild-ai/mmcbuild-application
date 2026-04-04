import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSubscriptionStatus } from "@/lib/stripe/subscription";
import { DashboardShell } from "./dashboard-shell";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile) return null;

  const [status, projectCount] = await Promise.all([
    getSubscriptionStatus(profile.org_id),
    (async () => {
      const admin = createAdminClient();
      const { count } = await admin
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("org_id", profile.org_id);
      return count ?? 0;
    })(),
  ]);

  const isAdmin = ["owner", "admin"].includes(profile.role);

  return (
    <DashboardShell
      status={status}
      isAdmin={isAdmin}
      hasProjects={projectCount > 0}
    />
  );
}
