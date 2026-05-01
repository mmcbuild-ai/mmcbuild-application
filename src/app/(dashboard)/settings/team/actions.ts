"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

interface ContributorRow {
  id: string;
  project_id: string;
  discipline: string;
  company_name: string | null;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  created_at: string;
}

export interface DirectoryEntry {
  /** Stable identity used by edit/remove actions. Email if present, else "name:<contact_name>". */
  identityKey: string;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  company_name: string | null;
  /** Disciplines this person appears under (one person can be e.g. structural on one project, certifier on another). */
  disciplines: string[];
  /** Project IDs this person is on. */
  project_ids: string[];
  /** Resolved project names for display. */
  project_names: string[];
  /** Total project count. */
  project_count: number;
  /** Earliest created_at across all rows. */
  first_added: string;
  /** Latest created_at across all rows. */
  last_added: string;
}

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

function identityKeyFor(row: { contact_email: string | null; contact_name: string }): string {
  if (row.contact_email && row.contact_email.trim()) {
    return `email:${row.contact_email.trim().toLowerCase()}`;
  }
  return `name:${row.contact_name.trim().toLowerCase()}`;
}

export async function getOrgContributorDirectory(): Promise<DirectoryEntry[]> {
  const profile = await getProfile();
  const admin = createAdminClient();

  const { data: rows } = await admin
    .from("project_contributors" as never)
    .select(
      "id, project_id, discipline, company_name, contact_name, contact_email, contact_phone, notes, created_at",
    )
    .eq("org_id", profile.org_id)
    .order("created_at", { ascending: true });

  const contributors = (rows ?? []) as ContributorRow[];
  if (contributors.length === 0) return [];

  // Resolve project names in one query
  const projectIds = Array.from(new Set(contributors.map((c) => c.project_id)));
  const { data: projectRows } = await admin
    .from("projects")
    .select("id, name")
    .in("id", projectIds);
  const projectNameById = new Map<string, string>();
  for (const p of (projectRows ?? []) as { id: string; name: string }[]) {
    projectNameById.set(p.id, p.name);
  }

  // Aggregate by identity key
  const map = new Map<string, DirectoryEntry>();
  for (const row of contributors) {
    const key = identityKeyFor(row);
    const projectName = projectNameById.get(row.project_id) ?? row.project_id;

    let entry = map.get(key);
    if (!entry) {
      entry = {
        identityKey: key,
        contact_name: row.contact_name,
        contact_email: row.contact_email,
        contact_phone: row.contact_phone,
        company_name: row.company_name,
        disciplines: [],
        project_ids: [],
        project_names: [],
        project_count: 0,
        first_added: row.created_at,
        last_added: row.created_at,
      };
      map.set(key, entry);
    }

    if (!entry.disciplines.includes(row.discipline)) {
      entry.disciplines.push(row.discipline);
    }
    if (!entry.project_ids.includes(row.project_id)) {
      entry.project_ids.push(row.project_id);
      entry.project_names.push(projectName);
    }
    if (row.created_at < entry.first_added) entry.first_added = row.created_at;
    if (row.created_at > entry.last_added) entry.last_added = row.created_at;
    // Prefer the most recent values for editable fields when they differ
    if (row.created_at >= entry.last_added) {
      entry.contact_phone = row.contact_phone ?? entry.contact_phone;
      entry.company_name = row.company_name ?? entry.company_name;
    }
    entry.project_count = entry.project_ids.length;
  }

  return Array.from(map.values()).sort((a, b) =>
    a.contact_name.localeCompare(b.contact_name, "en-AU", { sensitivity: "base" }),
  );
}

function parseIdentityKey(
  identityKey: string,
): { column: "contact_email" | "contact_name"; value: string } | null {
  if (identityKey.startsWith("email:")) {
    const email = identityKey.slice(6).trim();
    if (!email) return null;
    return { column: "contact_email", value: email };
  }
  if (identityKey.startsWith("name:")) {
    const name = identityKey.slice(5).trim();
    if (!name) return null;
    return { column: "contact_name", value: name };
  }
  return null;
}

/**
 * Update a directory entry — propagates to every row that matches the
 * identity key (email or name) within the org.
 */
export async function updateOrgContributor(
  identityKey: string,
  updates: {
    contact_name?: string;
    contact_email?: string | null;
    contact_phone?: string | null;
    company_name?: string | null;
  },
) {
  const profile = await getProfile();
  const admin = createAdminClient();

  const match = parseIdentityKey(identityKey);
  if (!match) return { error: "Invalid contributor identity" };

  const patch: Record<string, unknown> = {};
  if (updates.contact_name !== undefined) patch.contact_name = updates.contact_name;
  if (updates.contact_email !== undefined) patch.contact_email = updates.contact_email;
  if (updates.contact_phone !== undefined) patch.contact_phone = updates.contact_phone;
  if (updates.company_name !== undefined) patch.company_name = updates.company_name;

  if (Object.keys(patch).length === 0) {
    return { success: true, updatedRows: 0 };
  }

  const { error, count } = await admin
    .from("project_contributors" as never)
    .update(patch as never, { count: "exact" })
    .eq("org_id", profile.org_id)
    .ilike(match.column, match.value);

  if (error) return { error: `Update failed: ${error.message}` };

  revalidatePath("/settings/team");
  return { success: true, updatedRows: count ?? 0 };
}

/**
 * Remove the contributor from every project in the org. Soft action — the
 * person can always be re-added on a per-project basis.
 */
export async function removeOrgContributor(identityKey: string) {
  const profile = await getProfile();
  const admin = createAdminClient();

  if (profile.role !== "owner" && profile.role !== "admin") {
    return { error: "Only owners and admins can remove contributors org-wide" };
  }

  const match = parseIdentityKey(identityKey);
  if (!match) return { error: "Invalid contributor identity" };

  const { error, count } = await admin
    .from("project_contributors" as never)
    .delete({ count: "exact" })
    .eq("org_id", profile.org_id)
    .ilike(match.column, match.value);

  if (error) return { error: `Removal failed: ${error.message}` };

  revalidatePath("/settings/team");
  return { success: true, removedRows: count ?? 0 };
}
