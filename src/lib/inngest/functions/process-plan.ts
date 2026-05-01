import { inngest } from "../client";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestPlan } from "@/lib/comply/ingestion";

export const processPlan = inngest.createFunction(
  {
    id: "process-plan",
    name: "Process Plan Upload",
    retries: 2,
    onFailure: async ({ error, event }) => {
      const admin = createAdminClient();
      const { projectId, fileName, uploadedBy, planId } = event.data.event.data;

      if (planId) {
        await admin
          .from("plans")
          .update({ status: "error" } as never)
          .eq("id", planId);
      } else if (projectId && fileName && uploadedBy) {
        const { data: plan } = await admin
          .from("plans")
          .select("id")
          .eq("project_id", projectId)
          .eq("file_name", fileName)
          .eq("created_by", uploadedBy)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (plan) {
          await admin
            .from("plans")
            .update({ status: "error" } as never)
            .eq("id", plan.id);
        }
      }

      console.error(`[processPlan] Failed: ${error.message}`);
    },
  },
  { event: "plan/uploaded" },
  async ({ event, step }) => {
    const { projectId, fileName, uploadedBy, planId: eventPlanId } = event.data;

    // 1. Find the plan record. Selected with "*" because file_kind is a
    //    column added by migration 00039 and not yet in generated types.
    const plan = await step.run("find-plan-record", async () => {
      const admin = createAdminClient();

      type PlanRow = {
        id: string;
        org_id: string;
        file_path: string;
        file_name: string;
        file_kind?: "pdf" | "image" | "dwg" | null;
      };

      if (eventPlanId) {
        const { data, error } = await admin
          .from("plans")
          .select("*")
          .eq("id", eventPlanId)
          .single();

        if (error || !data) {
          throw new Error(`Plan record not found for ID ${eventPlanId}: ${error?.message}`);
        }
        return data as unknown as PlanRow;
      }

      const { data, error } = await admin
        .from("plans")
        .select("*")
        .eq("project_id", projectId)
        .eq("file_name", fileName)
        .eq("created_by", uploadedBy)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        throw new Error(`Plan record not found for ${fileName}: ${error?.message}`);
      }

      return data as unknown as PlanRow;
    });

    // 2. Update status to processing
    await step.run("update-status-processing", async () => {
      const admin = createAdminClient();
      await admin
        .from("plans")
        .update({ status: "processing" } as never)
        .eq("id", plan.id);
    });

    // 3. Download, parse, chunk, and embed in a single step
    //    (avoids passing large file buffers between steps — Inngest has a 4MB step output limit)
    //
    //    DWG files are converted to PDF via CloudConvert here so they flow
    //    through the same text/embedding pipeline as native PDFs. If
    //    conversion fails or CloudConvert is not configured, the file falls
    //    back to manual_review status (file stored, no auto extraction).
    const result = await step.run("download-and-ingest", async () => {
      const admin = createAdminClient();
      const { data, error } = await admin.storage
        .from("plan-uploads")
        .download(plan.file_path);

      if (error || !data) {
        throw new Error(`Failed to download file: ${error?.message}`);
      }

      const arrayBuffer = await data.arrayBuffer();
      let buffer: Buffer = Buffer.from(arrayBuffer);
      let kind: "pdf" | "image" | "dwg" = plan.file_kind ?? "pdf";

      if (kind === "dwg") {
        const { convertDwgToPdf } = await import("@/lib/plans/dwg-converter");
        const conv = await convertDwgToPdf(buffer, plan.file_name);
        if ("error" in conv) {
          console.warn(
            `[processPlan] DWG conversion failed for ${plan.id}: ${conv.error}. Falling back to manual_review.`,
          );
          return { pageCount: 0, chunkCount: 0, manualReview: true };
        }
        buffer = conv.pdfBuffer;
        kind = "pdf";
      }

      return await ingestPlan(plan.org_id, plan.id, buffer, kind, plan.file_name);
    });

    // 4. Update status: DWG/manual-review files are stored only; everything
    //    else is marked ready once chunks are embedded.
    await step.run("update-status-final", async () => {
      const admin = createAdminClient();
      await admin
        .from("plans")
        .update({
          status: result.manualReview ? "manual_review" : "ready",
          page_count: result.pageCount,
        } as never)
        .eq("id", plan.id);
    });

    return {
      planId: plan.id,
      pageCount: result.pageCount,
      chunkCount: result.chunkCount,
    };
  }
);
