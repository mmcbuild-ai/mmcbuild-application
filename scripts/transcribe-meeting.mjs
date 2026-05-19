#!/usr/bin/env node
// Transcribe a Zoom .m4a recording via OpenAI Whisper.
// Usage:
//   node --env-file=.env.local scripts/transcribe-meeting.mjs <audio-path> [output-path]
//
// Compresses to mono 16 kHz Opus first so the upload fits under the 25 MB Whisper API cap,
// then writes a plain-text transcript to the target path (default: docs/meeting-transcript-<date>.txt).

import { spawn } from "node:child_process";
import { createReadStream, statSync, mkdirSync, existsSync } from "node:fs";
import { writeFile, unlink } from "node:fs/promises";
import path from "node:path";

const audioPath = process.argv[2];
if (!audioPath) {
  console.error("Usage: node --env-file=.env.local scripts/transcribe-meeting.mjs <audio-path> [output-path]");
  process.exit(2);
}
if (!existsSync(audioPath)) {
  console.error(`Audio file not found: ${audioPath}`);
  process.exit(2);
}
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("OPENAI_API_KEY missing — load with --env-file=.env.local");
  process.exit(2);
}

const baseName = path.basename(audioPath, path.extname(audioPath));
const today = new Date().toISOString().slice(0, 10);
const outPath = process.argv[3] ?? path.join("docs", `meeting-transcript-${today}.txt`);
mkdirSync(path.dirname(outPath), { recursive: true });

const compressedPath = path.join(process.env.TEMP ?? ".", `${baseName}.compressed.ogg`);

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ["ignore", "inherit", "inherit"] });
    proc.on("error", reject);
    proc.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited with code ${code}`))
    );
  });
}

const fmtMB = (bytes) => (bytes / 1024 / 1024).toFixed(1);

console.log(`Source : ${audioPath} (${fmtMB(statSync(audioPath).size)} MB)`);
console.log(`Target : ${outPath}`);
console.log(`Compress → ${compressedPath}`);

await run("ffmpeg", [
  "-y",
  "-i", audioPath,
  "-ac", "1",
  "-ar", "16000",
  "-c:a", "libopus",
  "-b:a", "24k",
  compressedPath,
]);

const compressedSize = statSync(compressedPath).size;
console.log(`Compressed: ${fmtMB(compressedSize)} MB`);
if (compressedSize > 25 * 1024 * 1024) {
  console.error(`Compressed file still > 25 MB. Whisper API will reject.`);
  process.exit(1);
}

console.log("Uploading to Whisper…");
const form = new FormData();
const buffer = await new Promise((resolve, reject) => {
  const chunks = [];
  createReadStream(compressedPath)
    .on("data", (c) => chunks.push(c))
    .on("end", () => resolve(Buffer.concat(chunks)))
    .on("error", reject);
});
form.append("file", new Blob([buffer], { type: "audio/ogg" }), path.basename(compressedPath));
form.append("model", "whisper-1");
form.append("response_format", "text");
form.append("language", "en");

const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
  method: "POST",
  headers: { Authorization: `Bearer ${apiKey}` },
  body: form,
});
if (!res.ok) {
  console.error(`Whisper API ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const transcript = await res.text();

await writeFile(outPath, transcript, "utf8");
await unlink(compressedPath).catch(() => {});
const minutes = transcript.split(/\s+/).length / 150;
console.log(`✓ Transcript written to ${outPath}`);
console.log(`  ${transcript.length} chars, ~${minutes.toFixed(0)} min of speech (rough estimate)`);
