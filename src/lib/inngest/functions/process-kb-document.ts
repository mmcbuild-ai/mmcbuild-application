import { inngest } from "../client";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestKbDocument } from "@/lib/knowledge/ingestion";

export const processKbDocument = inngest.createFunction(
  {
    id: "process-kb-document",
    name: "Process Knowledge Base Document",
    retries: 2,
    onFailure: async ({ event }) => {
      const admin = createAdminClient();
      const documentId = event.data.event.data.documentId;
      const errorMsg =
        event.data.error?.message ?? "Processing failed after retries";

      await admin
        .from("knowledge_documents")
        .update({
          status: "error",
          error_message: errorMsg,
        } as never)
        .eq("id", documentId);

      console.error(
        `[KB Processing] Document ${documentId} failed: ${errorMsg}`
      );
    },
  },
  { event: "kb/document.uploaded" },
  async ({ event, step }) => {
    const { documentId, kbId, filePath, fileName } = event.data;

    // 1. Load document and KB details
    const docInfo = await step.run("load-document", async () => {
      const admin = createAdminClient();

      const { data: doc, error: docErr } = await admin
        .from("knowledge_documents")
        .select("id, kb_id, file_name, file_path")
        .eq("id", documentId)
        .single();

      if (docErr || !doc) {
        throw new Error(`KB document not found: ${docErr?.message}`);
      }

      const { data: kb, error: kbErr } = await admin
        .from("knowledge_bases")
        .select("id, scope, org_id")
        .eq("id", kbId)
        .single();

      if (kbErr || !kb) {
        throw new Error(`Knowledge base not found: ${kbErr?.message}`);
      }

      return {
        doc: doc as { id: string; kb_id: string; file_name: string; file_path: string },
        kb: kb as { id: string; scope: "system" | "org"; org_id: string | null },
      };
    });

    // 2. Update status to processing
    await step.run("update-status-processing", async () => {
      const admin = createAdminClient();
      await admin
        .from("knowledge_documents")
        .update({ status: "processing" } as never)
        .eq("id", documentId);
    });

    // 3. Download file from storage (skip for manual text entries)
    const ext = (fileName ?? filePath ?? "").split(".").pop()?.toLowerCase();
    const isManualText = ext === "txt" && filePath.startsWith("manual/");

    const fileContent = await step.run("download-file", async () => {
      if (isManualText) {
        // Manual text entries are stored directly — download as-is
        const admin = createAdminClient();
        const { data, error } = await admin.storage
          .from("kb-uploads")
          .download(filePath);

        if (error || !data) {
          throw new Error(`Failed to download file: ${error?.message}`);
        }

        const text = await data.text();
        return { type: "text" as const, text, base64: "" };
      }

      const admin = createAdminClient();
      const { data, error } = await admin.storage
        .from("kb-uploads")
        .download(filePath);

      if (error || !data) {
        throw new Error(`Failed to download KB file: ${error?.message}`);
      }

      const arrayBuffer = await data.arrayBuffer();
      return {
        type: "binary" as const,
        text: "",
        base64: Buffer.from(arrayBuffer).toString("base64"),
      };
    });

    // 4. Ingest document
    const result = await step.run("ingest-document", async () => {
      if (fileContent.type === "text") {
        // Text content — pass directly to ingestion as raw text
        return await ingestKbDocument(
          docInfo.kb.id,
          documentId,
          null,
          docInfo.kb.scope,
          docInfo.kb.org_id,
          fileContent.text
        );
      }

      const buffer = Buffer.from(fileContent.base64, "base64");

      // For non-PDF files that we can't parse, store as single chunk
      const parseable = ["pdf"].includes(ext ?? "");
      if (!parseable) {
        return await ingestKbDocument(
          docInfo.kb.id,
          documentId,
          null,
          docInfo.kb.scope,
          docInfo.kb.org_id,
          `[File: ${fileName}] This is a ${ext?.toUpperCase()} file uploaded to the knowledge base. File contents are stored as a reference.`
        );
      }

      return await ingestKbDocument(
        docInfo.kb.id,
        documentId,
        buffer,
        docInfo.kb.scope,
        docInfo.kb.org_id
      );
    });

    return {
      documentId,
      kbId,
      pageCount: result.pageCount,
      chunkCount: result.chunkCount,
    };
  }
);
