#!/usr/bin/env node
// Chunked Whisper transcription — splits audio into ~5-min segments and transcribes each
// separately, then concatenates. Robust against VPN / firewall idle timeouts that kill
// long-lived single uploads. Uses curl (Windows schannel handles large multipart better
// than undici).
//
// Usage: node --env-file=.env.local scripts/transcribe-chunked.mjs <audio-path> [output-path]

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, statSync, readdirSync } from "node:fs";
import { readFile, writeFile, unlink, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const audioPath = process.argv[2];
if (!audioPath) {
  console.error("Usage: node --env-file=.env.local scripts/transcribe-chunked.mjs <audio-path> [output-path]");
  process.exit(2);
}
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) { console.error("OPENAI_API_KEY missing"); process.exit(2); }
if (!existsSync(audioPath)) { console.error(`File not found: ${audioPath}`); process.exit(2); }

const today = new Date().toISOString().slice(0, 10);
const outPath = process.argv[3] ?? path.join("docs", `meeting-transcript-${today}.txt`);
mkdirSync(path.dirname(outPath), { recursive: true });

const workDir = path.join(os.tmpdir(), `transcribe-${Date.now()}`);
mkdirSync(workDir, { recursive: true });
const segmentTime = 300; // seconds (5 min)

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: opts.silent ? "pipe" : "inherit", ...opts });
    let stdout = "", stderr = "";
    if (opts.silent) {
      proc.stdout?.on("data", (d) => (stdout += d));
      proc.stderr?.on("data", (d) => (stderr += d));
    }
    proc.on("error", reject);
    proc.on("exit", (code) =>
      code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`${cmd} exit ${code}: ${stderr}`))
    );
  });
}

console.log(`Splitting → ${workDir} (${segmentTime}s segments, mono 16kHz Opus)`);
await run("ffmpeg", [
  "-y",
  "-i", audioPath,
  "-ac", "1", "-ar", "16000",
  "-c:a", "libopus", "-b:a", "24k",
  "-f", "segment", "-segment_time", String(segmentTime),
  "-reset_timestamps", "1",
  path.join(workDir, "chunk-%03d.ogg"),
]);

const chunks = readdirSync(workDir).filter((f) => f.endsWith(".ogg")).sort();
console.log(`${chunks.length} chunks ready`);
const transcripts = [];

for (const [idx, file] of chunks.entries()) {
  const full = path.join(workDir, file);
  const sizeMB = (statSync(full).size / 1024 / 1024).toFixed(2);
  console.log(`[${idx + 1}/${chunks.length}] ${file} (${sizeMB} MB)…`);
  const segOut = path.join(workDir, `${file}.txt`);
  await run("curl", [
    "-sS", "--fail-with-body",
    "-X", "POST",
    "https://api.openai.com/v1/audio/transcriptions",
    "-H", `Authorization: Bearer ${apiKey}`,
    "-F", `file=@${full};type=audio/ogg`,
    "-F", "model=whisper-1",
    "-F", "response_format=text",
    "-F", "language=en",
    "-o", segOut,
    "--max-time", "180",
  ]);
  const text = await readFile(segOut, "utf8");
  transcripts.push(text.trim());
  await unlink(full).catch(() => {});
  await unlink(segOut).catch(() => {});
}

await writeFile(outPath, transcripts.join("\n\n"), "utf8");
await rm(workDir, { recursive: true, force: true }).catch(() => {});

const totalChars = transcripts.reduce((a, t) => a + t.length, 0);
console.log(`✓ ${totalChars} chars written to ${outPath}`);
