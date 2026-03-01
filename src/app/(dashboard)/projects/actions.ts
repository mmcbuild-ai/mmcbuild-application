"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function getProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, org_id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile) throw new Error("Profile not found");
  return profile as { id: string; org_id: string; role: string };
}

export async function createProject(formData: FormData) {
  const profile = await getProfile();
  const admin = createAdminClient();

  const name = formData.get("name") as string;
  const address = (formData.get("address") as string) || null;

  if (!name?.trim()) throw new Error("Project name is required");

  const { error } = await admin.from("projects").insert({
    org_id: profile.org_id,
    name: name.trim(),
    address,
    status: "draft",
    created_by: profile.id,
  } as never);

  if (error) throw new Error(`Failed to create project: ${error.message}`);
  revalidatePath("/projects");
}
