import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfessional } from "../actions";
import { RegistrationForm } from "@/components/direct/registration-form";

export default async function RegisterPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, org_id")
    .eq("user_id", user.id)
    .single();

  if (!profile) redirect("/login");

  // If org already has a listing, redirect to dashboard
  const existing = await getMyProfessional();
  if (existing) redirect("/direct/dashboard");

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Register Your Business</h1>
        <p className="text-muted-foreground mt-1">
          Join the MMC Direct trade directory to connect with project owners across Australia.
          Your listing will be reviewed by our team before going live.
        </p>
      </div>

      <RegistrationForm orgId={profile.org_id} />
    </div>
  );
}
