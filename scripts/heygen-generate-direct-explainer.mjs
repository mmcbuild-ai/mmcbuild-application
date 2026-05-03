#!/usr/bin/env node
/**
 * Generate the MMC Direct module explainer video via HeyGen.
 *
 * Output: public/videos/direct-explainer.mp4
 * Cost:   ~$1 per render (Public Avatar III tier, ~60s clip)
 *
 * Usage:
 *   node scripts/heygen-generate-direct-explainer.mjs --list-avatars
 *   node scripts/heygen-generate-direct-explainer.mjs --list-voices
 *   node scripts/heygen-generate-direct-explainer.mjs
 *   node scripts/heygen-generate-direct-explainer.mjs --avatar <id> --voice <id>
 *   node scripts/heygen-generate-direct-explainer.mjs --dry-run
 */
import { join } from "path";
import {
  runHeyGenGenerator,
  DEFAULT_AVATAR_ID,
  DEFAULT_VOICE_ID,
  DEFAULT_BACKGROUND_HEX,
} from "./heygen/_lib.mjs";

// ~150 words. ICP: architects, designers, and builders looking for verified
// MMC suppliers. Trade audience too, but secondary.
const SCRIPT = `MMC Direct is Australia's directory of Modern Methods of Construction suppliers — prefab, panelised, modular, hybrid, and 3D concrete printing — searchable by state, capability, and certification.

Each supplier listing shows the products they actually deliver, the certifications attached to those products, lead times, and the project sizes they take on. Compliance documents — CodeMark certificates, NCC reports, datasheets — are uploaded by suppliers and verified by us, so you can call them up on your drawings with confidence.

When you find a supplier whose product matches a suggestion in your Build run, you can get a quote inside MMC Quote without leaving the platform.

For suppliers, listing is free. Featured placements surface your products inside MMC Build suggestions and put you in front of architects who are actively designing with MMC right now.`;

await runHeyGenGenerator({
  module: "direct",
  avatarId: DEFAULT_AVATAR_ID,
  voiceId: DEFAULT_VOICE_ID,
  script: SCRIPT,
  backgroundHex: DEFAULT_BACKGROUND_HEX,
  outputPath: join(process.cwd(), "public", "videos", "direct-explainer.mp4"),
});
