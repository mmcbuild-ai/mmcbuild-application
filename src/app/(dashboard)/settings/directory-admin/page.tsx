import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPendingProfessionals, approveProfessional, suspendProfessional } from "../../direct/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TRADE_TYPE_LABELS } from "@/lib/direct/constants";
import { revalidatePath } from "next/cache";
import type { TradeType } from "@/lib/direct/types";

export default async function DirectoryAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, org_id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || (profile.role !== "owner" && profile.role !== "admin")) {
    redirect("/settings");
  }

  const pending = await getPendingProfessionals();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Directory Admin</h1>
        <p className="text-muted-foreground">Review and approve trade directory listings</p>
      </div>

      {pending.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">No pending listings to review.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pending.map((pro: { id: string; company_name: string; trade_type: string; regions: string[]; created_at: string; abn: string | null }) => (
            <Card key={pro.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{pro.company_name}</CardTitle>
                    <CardDescription>
                      {TRADE_TYPE_LABELS[pro.trade_type as TradeType] || pro.trade_type}
                      {pro.abn && ` — ABN: ${pro.abn}`}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-amber-700 border-amber-300">Pending</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    <span>Regions: {pro.regions?.join(", ") || "None"}</span>
                    <span className="ml-4">
                      Submitted: {new Date(pro.created_at).toLocaleDateString("en-AU")}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <form action={async () => {
                      "use server";
                      await approveProfessional(pro.id);
                      revalidatePath("/settings/directory-admin");
                    }}>
                      <Button type="submit" size="sm" className="bg-green-600 hover:bg-green-700">
                        Approve
                      </Button>
                    </form>
                    <form action={async () => {
                      "use server";
                      await suspendProfessional(pro.id);
                      revalidatePath("/settings/directory-admin");
                    }}>
                      <Button type="submit" size="sm" variant="destructive">
                        Suspend
                      </Button>
                    </form>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
