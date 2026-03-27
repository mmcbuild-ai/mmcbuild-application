import { createClient } from "@/lib/supabase/server";
import { getSubscriptionStatus } from "@/lib/stripe/subscription";
import { DashboardModules } from "./dashboard-modules";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!profile) return null;

  const status = await getSubscriptionStatus(profile.org_id);

  return <DashboardModules status={status} />;
}
