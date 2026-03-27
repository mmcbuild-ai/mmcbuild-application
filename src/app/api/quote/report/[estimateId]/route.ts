import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/supabase/db";
import { generateCostPdf } from "@/lib/quote/report-pdf";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ estimateId: string }> }
) {
  const { estimateId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = db();

  const { data: estimate, error: estError } = await admin
    .from("cost_estimates")
    .select("id, status, summary, total_traditional, total_mmc, total_savings_pct, region, traditional_duration_weeks, mmc_duration_weeks, completed_at, project_id")
    .eq("id", estimateId)
    .single();

  if (estError || !estimate) {
    return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
  }

  const rec = estimate as {
    id: string; status: string; summary: string | null;
    total_traditional: number | null; total_mmc: number | null; total_savings_pct: number | null;
    region: string | null; traditional_duration_weeks: number | null; mmc_duration_weeks: number | null;
    completed_at: string | null; project_id: string;
  };

  if (rec.status !== "completed") {
    return NextResponse.json({ error: "Report not yet completed" }, { status: 400 });
  }

  const { data: project } = await admin
    .from("projects")
    .select("name, address")
    .eq("id", rec.project_id)
    .single();

  const { data: lineItems } = await admin
    .from("cost_line_items")
    .select("*")
    .eq("estimate_id", estimateId)
    .order("sort_order", { ascending: true });

  const pdfBytes = generateCostPdf({
    projectName: project?.name ?? "Untitled Project",
    projectAddress: project?.address ?? null,
    summary: rec.summary ?? "",
    totalTraditional: rec.total_traditional ?? 0,
    totalMmc: rec.total_mmc ?? 0,
    totalSavingsPct: rec.total_savings_pct,
    region: rec.region,
    completedAt: rec.completed_at ?? new Date().toISOString(),
    traditionalDurationWeeks: rec.traditional_duration_weeks ?? null,
    mmcDurationWeeks: rec.mmc_duration_weeks ?? null,
    lineItems: (lineItems ?? []) as {
      cost_category: string;
      element_description: string;
      quantity: number | null;
      unit: string | null;
      traditional_rate: number | null;
      traditional_total: number | null;
      mmc_rate: number | null;
      mmc_total: number | null;
      mmc_alternative: string | null;
      savings_pct: number | null;
      source: string;
      confidence: number;
      rate_source_name: string | null;
    }[],
  });

  const projectSlug = (project?.name ?? "project")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+$/, "");

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="mmc-quote-${projectSlug}-${estimateId.slice(0, 8)}.pdf"`,
    },
  });
}
