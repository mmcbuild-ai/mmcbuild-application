/**
 * DWG → PDF conversion via CloudConvert.
 *
 * AutoCAD DWG is a proprietary binary format with no native Node parser.
 * CloudConvert runs the conversion server-side and we feed the resulting PDF
 * into the existing plan ingestion pipeline (text + chunks + embeddings).
 *
 * Environment:
 *   CLOUDCONVERT_API_KEY — server-side only, never expose to client.
 *
 * Pricing (approx): ~$0.005-$0.02 per DWG depending on size / complexity.
 *
 * NOTE: This produces a PDF, which captures geometry but loses CAD layer
 * names / structured dimensional data. A future enhancement would convert to
 * DXF and parse layer entities directly for true 3D vectoring source data.
 */

const CLOUDCONVERT_BASE = "https://api.cloudconvert.com/v2";
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 80; // ~4 minutes
const MAX_DWG_BYTES = 50 * 1024 * 1024; // 50 MB matches plan-uploads cap

export type DwgConvertResult =
  | { pdfBuffer: Buffer }
  | { error: string };

interface CCTaskResultForm {
  url: string;
  parameters: Record<string, string>;
}

interface CCTask {
  name: string;
  status?: string;
  result?: {
    form?: CCTaskResultForm;
    files?: { url: string; filename: string }[];
  };
}

interface CCJobResponse {
  data: { id: string; status: string; tasks: CCTask[] };
}

export async function convertDwgToPdf(
  dwgBuffer: Buffer,
  fileName: string,
): Promise<DwgConvertResult> {
  const apiKey = process.env.CLOUDCONVERT_API_KEY;
  if (!apiKey) {
    return { error: "CLOUDCONVERT_API_KEY not configured" };
  }
  if (dwgBuffer.length > MAX_DWG_BYTES) {
    return { error: `File exceeds ${MAX_DWG_BYTES / 1024 / 1024}MB limit` };
  }

  // 1. Create a job: upload → convert → export-url
  const jobResp = await fetch(`${CLOUDCONVERT_BASE}/jobs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tasks: {
        "import-file": { operation: "import/upload" },
        "convert-file": {
          operation: "convert",
          input: "import-file",
          input_format: "dwg",
          output_format: "pdf",
        },
        "export-file": {
          operation: "export/url",
          input: "convert-file",
        },
      },
    }),
  });

  if (!jobResp.ok) {
    const text = await jobResp.text().catch(() => "");
    return { error: `CloudConvert job creation failed: ${jobResp.status} ${text.slice(0, 200)}` };
  }

  const job = (await jobResp.json()) as CCJobResponse;
  const jobId = job.data.id;
  const importTask = job.data.tasks.find((t) => t.name === "import-file");
  const uploadForm = importTask?.result?.form;

  if (!uploadForm?.url) {
    return { error: "CloudConvert did not return an upload URL" };
  }

  // 2. Upload the DWG via the signed multipart form
  const form = new FormData();
  for (const [key, value] of Object.entries(uploadForm.parameters)) {
    form.append(key, value);
  }
  form.append(
    "file",
    new Blob([new Uint8Array(dwgBuffer)], { type: "application/acad" }),
    fileName,
  );

  const uploadResp = await fetch(uploadForm.url, {
    method: "POST",
    body: form,
  });

  if (!uploadResp.ok) {
    const text = await uploadResp.text().catch(() => "");
    return { error: `DWG upload to CloudConvert failed: ${uploadResp.status} ${text.slice(0, 200)}` };
  }

  // 3. Poll the job status until conversion finishes (or fails / times out)
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const statusResp = await fetch(`${CLOUDCONVERT_BASE}/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!statusResp.ok) continue;

    const status = (await statusResp.json()) as CCJobResponse;

    if (status.data.status === "finished") {
      const exportTask = status.data.tasks.find((t) => t.name === "export-file");
      const fileUrl = exportTask?.result?.files?.[0]?.url;
      if (!fileUrl) {
        return { error: "CloudConvert finished without an export URL" };
      }

      const fileResp = await fetch(fileUrl);
      if (!fileResp.ok) {
        return { error: `Converted PDF download failed: ${fileResp.status}` };
      }

      const arrayBuffer = await fileResp.arrayBuffer();
      return { pdfBuffer: Buffer.from(arrayBuffer) };
    }

    if (status.data.status === "error") {
      const failed = status.data.tasks.find((t) => t.status === "error");
      return { error: `CloudConvert task failed: ${failed?.name ?? "unknown"}` };
    }
  }

  return { error: "CloudConvert job timed out" };
}
