"use server";

import { db } from "@/lib/supabase/db";

export type ReportModule = "comply" | "build" | "quote";

export async function createReportVersion(params: {
  projectId: string;
  orgId: string;
  module: ReportModule;
  sourceId: string;
  reportData: Record<string, unknown>;
  createdBy?: string;
}): Promise<{ versionId: string; versionNumber: number }> {
  const admin = db();

  // Get next version number for this project + module
  const { data: latest } = await admin
    .from("report_versions")
    .select("version_number")
    .eq("project_id", params.projectId)
    .eq("module", params.module)
    .order("version_number", { ascending: false })
    .limit(1)
    .single();

  const nextVersion = ((latest as { version_number: number } | null)?.version_number ?? 0) + 1;

  const { data: version, error } = await admin
    .from("report_versions")
    .insert({
      project_id: params.projectId,
      org_id: params.orgId,
      module: params.module,
      version_number: nextVersion,
      source_id: params.sourceId,
      report_data: params.reportData,
      created_by: params.createdBy ?? null,
    })
    .select("id")
    .single();

  if (error || !version) {
    console.error("[ReportVersions] Failed to create version:", error?.message);
    throw new Error(`Failed to create report version: ${error?.message}`);
  }

  return {
    versionId: (version as { id: string }).id,
    versionNumber: nextVersion,
  };
}

export async function getReportVersions(
  projectId: string,
  module: ReportModule
) {
  const admin = db();

  const { data } = await admin
    .from("report_versions")
    .select("id, version_number, source_id, created_at, pdf_url")
    .eq("project_id", projectId)
    .eq("module", module)
    .order("version_number", { ascending: false });

  return (data ?? []) as {
    id: string;
    version_number: number;
    source_id: string;
    created_at: string;
    pdf_url: string | null;
  }[];
}

export async function getReportVersion(versionId: string) {
  const admin = db();

  const { data } = await admin
    .from("report_versions")
    .select("id, project_id, org_id, module, version_number, source_id, report_data, pdf_url, created_at")
    .eq("id", versionId)
    .single();

  return data as {
    id: string;
    project_id: string;
    org_id: string;
    module: ReportModule;
    version_number: number;
    source_id: string;
    report_data: Record<string, unknown>;
    pdf_url: string | null;
    created_at: string;
  } | null;
}

export async function updateReportVersionPdfUrl(
  versionId: string,
  pdfUrl: string
) {
  const admin = db();
  await admin
    .from("report_versions")
    .update({ pdf_url: pdfUrl })
    .eq("id", versionId);
}
