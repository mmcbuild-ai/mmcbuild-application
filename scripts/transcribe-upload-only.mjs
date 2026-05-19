#!/usr/bin/env node
// Retry-friendly Whisper upload that reuses an existing compressed audio file.
// Usage: node --env-file=.env.local scripts/transcribe-upload-only.mjs <compressed-path> [output-path]

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const inPath = process.argv[2];
if (!inPath) {
  console.error("Usage: node --env-file=.env.local scripts/transcribe-upload-only.mjs <compressed-path> [output-path]");
  process.exit(2);
}
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) { console.error("OPENAI_API_KEY missing"); process.exit(2); }

const today = new Date().toISOString().slice(0, 10);
const outPath = process.argv[3] ?? path.join("docs", `meeting-transcript-${today}.txt`);

const buffer = await readFile(inPath);
console.log(`Loaded ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB from ${inPath}`);

const MAX_TRIES = 4;
let lastErr;
for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
  console.log(`Upload attempt ${attempt}/${MAX_TRIES}…`);
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: "audio/ogg" }), path.basename(inPath));
  form.append("model", "whisper-1");
  form.append("response_format", "text");
  form.append("language", "en");
  try {
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(540_000),
    });
    if (!res.ok) {
      const body = await res.text();
      lastErr = new Error(`HTTP ${res.status}: ${body.slice(0, 500)}`);
      if (res.status >= 500 || res.status === 429) {
        await new Promise((r) => setTimeout(r, 5_000 * attempt));
        continue;
      }
      throw lastErr;
    }
    const transcript = await res.text();
    await writeFile(outPath, transcript, "utf8");
    console.log(`✓ ${transcript.length} chars written to ${outPath}`);
    process.exit(0);
  } catch (err) {
    lastErr = err;
    console.warn(`  Attempt ${attempt} failed: ${err.message ?? err}`);
    if (attempt < MAX_TRIES) await new Promise((r) => setTimeout(r, 5_000 * attempt));
  }
}
console.error(`All ${MAX_TRIES} attempts failed. Last error:`, lastErr);
process.exit(1);
