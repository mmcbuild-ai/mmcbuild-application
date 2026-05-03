// Shared helper for the per-module HeyGen explainer-video generator scripts.
// Mirrors src/lib/heygen/client.ts in plain JS so the .mjs scripts can run
// without tsx. Server-side only — relies on HEYGEN_API_KEY in .env.local.
//
// Each generator script imports `runHeyGenGenerator` and provides:
//   { module, avatarId, voiceId, script, backgroundHex?, outputPath }
// The helper handles --list-avatars / --list-voices, the render submission,
// status polling, and the MP4 download to public/videos/.

import { readFileSync, existsSync } from "fs";
import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "path";

// ---------------------------------------------------------------------------
// .env.local loader (matches the pattern used by scripts/jira-*.mjs)
// ---------------------------------------------------------------------------

const envPath = join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  readFileSync(envPath, "utf8")
    .split("\n")
    .forEach((line) => {
      const [k, ...rest] = line.split("=");
      if (k && rest.length && !process.env[k.trim()]) {
        let v = rest.join("=").trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        process.env[k.trim()] = v;
      }
    });
}

// ---------------------------------------------------------------------------
// HeyGen API client
// ---------------------------------------------------------------------------

const API_BASE = "https://api.heygen.com";

function authHeaders() {
  const key = process.env.HEYGEN_API_KEY;
  if (!key) throw new Error("HEYGEN_API_KEY not set in .env.local or environment");
  return { "X-Api-Key": key, "Content-Type": "application/json" };
}

export async function listAvatars() {
  const res = await fetch(`${API_BASE}/v2/avatars`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`HeyGen listAvatars ${res.status}: ${await res.text().catch(() => "")}`);
  const json = await res.json();
  return json.data?.avatars ?? [];
}

export async function listVoices() {
  const res = await fetch(`${API_BASE}/v2/voices`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`HeyGen listVoices ${res.status}: ${await res.text().catch(() => "")}`);
  const json = await res.json();
  return json.data?.voices ?? [];
}

export async function generateVideo({ avatarId, voiceId, text, width = 1280, height = 720, backgroundHex = "#0f172a" }) {
  const body = {
    video_inputs: [
      {
        character: { type: "avatar", avatar_id: avatarId, avatar_style: "normal" },
        voice: { type: "text", input_text: text, voice_id: voiceId },
        background: { type: "color", value: backgroundHex },
      },
    ],
    dimension: { width, height },
  };
  const res = await fetch(`${API_BASE}/v2/video/generate`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HeyGen generateVideo ${res.status}: ${await res.text().catch(() => "")}`);
  const json = await res.json();
  const id = json.data?.video_id;
  if (!id) throw new Error("HeyGen generateVideo: video_id missing in response");
  return id;
}

export async function getVideoStatus(videoId) {
  const res = await fetch(`${API_BASE}/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`HeyGen getVideoStatus ${res.status}: ${await res.text().catch(() => "")}`);
  const json = await res.json();
  const data = json.data ?? {};
  const err = typeof data.error === "string" ? data.error : (data.error?.message ?? null);
  return {
    status: data.status ?? "pending",
    videoUrl: data.video_url ?? null,
    thumbnailUrl: data.thumbnail_url ?? null,
    error: err,
  };
}

// ---------------------------------------------------------------------------
// Generator entry point — called by each per-module script
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 10_000;
const POLL_TIMEOUT_MS = 10 * 60_000;

/**
 * Run a HeyGen render, poll to completion, download the MP4 to outputPath.
 * Handles --list-avatars / --list-voices / --avatar / --voice / --dry-run CLI args.
 *
 * @param {{
 *   module: string,
 *   avatarId: string,
 *   voiceId: string,
 *   script: string,
 *   backgroundHex?: string,
 *   outputPath: string,
 * }} cfg
 */
export async function runHeyGenGenerator(cfg) {
  const args = process.argv.slice(2);
  const argSet = new Set(args);

  if (argSet.has("--list-avatars")) {
    const avatars = await listAvatars();
    console.log(`\n${avatars.length} avatars available:\n`);
    for (const a of avatars.slice(0, 50)) {
      console.log(`  ${a.avatar_id.padEnd(40)}  ${a.avatar_name}${a.gender ? ` (${a.gender})` : ""}`);
    }
    if (avatars.length > 50) console.log(`  ... and ${avatars.length - 50} more`);
    return;
  }

  if (argSet.has("--list-voices")) {
    const voices = await listVoices();
    const en = voices.filter((v) => (v.language ?? "").toLowerCase().startsWith("en"));
    console.log(`\n${en.length} English voices (of ${voices.length} total):\n`);
    for (const v of en.slice(0, 50)) {
      console.log(`  ${v.voice_id.padEnd(36)}  ${v.name.padEnd(28)} ${v.gender} ${v.language}`);
    }
    return;
  }

  // CLI overrides
  const avatarOverride = (() => {
    const i = args.indexOf("--avatar");
    return i >= 0 ? args[i + 1] : null;
  })();
  const voiceOverride = (() => {
    const i = args.indexOf("--voice");
    return i >= 0 ? args[i + 1] : null;
  })();

  const avatarId = avatarOverride || cfg.avatarId;
  const voiceId = voiceOverride || cfg.voiceId;

  console.log(`Module:   ${cfg.module}`);
  console.log(`Avatar:   ${avatarId}`);
  console.log(`Voice:    ${voiceId}`);
  console.log(`Script:   ${cfg.script.length} chars (~${Math.round(cfg.script.length / 15)}s @ 15 char/s pace)`);
  console.log(`BG:       ${cfg.backgroundHex ?? "#0f172a"}`);
  console.log(`Output:   ${cfg.outputPath}`);
  console.log(`Cost:     ~$1 (HeyGen Public Avatar III tier, ~60s clip)`);
  console.log("");

  if (argSet.has("--dry-run")) {
    console.log("DRY-RUN — no render submitted. Exit.");
    return;
  }

  console.log("Submitting render...");
  const videoId = await generateVideo({
    avatarId,
    voiceId,
    text: cfg.script,
    backgroundHex: cfg.backgroundHex,
  });
  console.log(`  video_id = ${videoId}`);

  const start = Date.now();
  let videoUrl = null;
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const status = await getVideoStatus(videoId);
    const elapsed = Math.round((Date.now() - start) / 1000);
    console.log(`  [${elapsed}s] status=${status.status}`);
    if (status.status === "completed" && status.videoUrl) {
      videoUrl = status.videoUrl;
      break;
    }
    if (status.status === "failed") {
      throw new Error(`HeyGen render failed: ${status.error ?? "unknown"}`);
    }
  }
  if (!videoUrl) throw new Error("HeyGen render timed out after 10 min");

  console.log(`\nDownloading from ${videoUrl}...`);
  const dl = await fetch(videoUrl);
  if (!dl.ok) throw new Error(`Download failed: ${dl.status}`);
  const buf = Buffer.from(await dl.arrayBuffer());
  await mkdir(dirname(cfg.outputPath), { recursive: true });
  await writeFile(cfg.outputPath, buf);
  console.log(`Saved ${(buf.byteLength / 1024 / 1024).toFixed(2)} MB → ${cfg.outputPath}`);
  console.log(`\nNext: commit ${cfg.outputPath.replace(process.cwd(), ".").replace(/\\/g, "/")} and redeploy.`);
}

// ---------------------------------------------------------------------------
// Shared defaults for ICP-aligned avatar/voice across all modules
// ---------------------------------------------------------------------------

// Picked from HeyGen's public avatar tier. Override per script via --avatar
// after running `--list-avatars` if a specific module wants a different look.
// Currently a sensible default — change once we've reviewed the avatar gallery.
export const DEFAULT_AVATAR_ID =
  process.env.HEYGEN_DEFAULT_AVATAR_ID ?? "Daisy-inskirt-20220818";

// Female English voice, professional/warm — matches an "MMC explained simply"
// tone for our architect/designer ICP. Override per script via --voice.
export const DEFAULT_VOICE_ID =
  process.env.HEYGEN_DEFAULT_VOICE_ID ?? "1bd001e7e50f421d891986aad5158bc8";

// Slate / dark teal — pairs with the existing module hero gradients.
export const DEFAULT_BACKGROUND_HEX =
  process.env.HEYGEN_DEFAULT_BACKGROUND ?? "#0f172a";
