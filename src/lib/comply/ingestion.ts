import { createAdminClient } from "@/lib/supabase/admin";
import { parsePdf } from "@/lib/pdf/parser";
import { chunkText } from "@/lib/pdf/chunker";
import { generateEmbeddings } from "@/lib/ai/openai";

export async function ingestPlan(
  orgId: string,
  planId: string,
  pdfBuffer: Buffer
): Promise<{ pageCount: number; chunkCount: number }> {
  const admin = createAdminClient();

  // 1. Parse PDF
  const parsed = await parsePdf(pdfBuffer);

  // 2. Update plan with page count
  await admin
    .from("plans")
    .update({ page_count: parsed.pageCount } as never)
    .eq("id", planId);

  // 3. Chunk the text
  const chunks = chunkText(parsed.text, {
    sourceType: "plan",
    sourceId: planId,
  });

  if (chunks.length === 0) {
    return { pageCount: parsed.pageCount, chunkCount: 0 };
  }

  // 4. Generate embeddings for all chunks
  const embeddings = await generateEmbeddings(chunks.map((c) => c.content));

  // 5. Delete any existing embeddings for this plan (re-processing)
  await admin
    .from("document_embeddings")
    .delete()
    .eq("source_type", "plan")
    .eq("source_id", planId);

  // 6. Insert chunks with embeddings
  const rows = chunks.map((chunk, i) => ({
    org_id: orgId,
    source_type: "plan" as const,
    source_id: planId,
    chunk_index: chunk.chunk_index,
    content: chunk.content,
    metadata: chunk.metadata,
    embedding: JSON.stringify(embeddings[i].embedding),
  }));

  // Insert in batches of 50
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const { error } = await admin.from("document_embeddings").insert(batch as never);
    if (error) {
      throw new Error(`Failed to insert embeddings batch ${i}: ${error.message}`);
    }
  }

  console.log(
    `[Ingestion] Plan ${planId}: ${parsed.pageCount} pages, ${chunks.length} chunks embedded`
  );

  return { pageCount: parsed.pageCount, chunkCount: chunks.length };
}
