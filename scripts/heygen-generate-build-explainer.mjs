#!/usr/bin/env node
/**
 * Generate the MMC Build module explainer video via HeyGen.
 *
 * Output: public/videos/build-explainer.mp4
 * Cost:   ~$1 per render (Public Avatar III tier, ~60s clip)
 *
 * Usage:
 *   # First time: pick avatar + voice
 *   node scripts/heygen-generate-build-explainer.mjs --list-avatars
 *   node scripts/heygen-generate-build-explainer.mjs --list-voices
 *
 *   # Default render
 *   node scripts/heygen-generate-build-explainer.mjs
 *
 *   # Override avatar / voice / dry-run
 *   node scripts/heygen-generate-build-explainer.mjs --avatar <id> --voice <id>
 *   node scripts/heygen-generate-build-explainer.mjs --dry-run
 *
 * Re-run any time the script changes; commit the resulting MP4.
 */
import { join } from "path";
import {
  runHeyGenGenerator,
  DEFAULT_AVATAR_ID,
  DEFAULT_VOICE_ID,
  DEFAULT_BACKGROUND_HEX,
} from "./heygen/_lib.mjs";

// ~150 words. ICP: architects and designers at concept/schematic stage,
// pre-DA. Keep it short, plain, and outcome-focused — no jargon dumps.
const SCRIPT = `MMC Build is for architects and designers who want to know whether Modern Methods of Construction would actually pay back on a project — before the drawings lock and before council submission.

Run it on a concept or schematic plan and Build looks at every wall, floor, and roof, and tells you which prefab, panelised, or modular elements would save time, save cost, or unlock a sustainability story for the client.

You'll see each suggestion with its impact, its complexity, and a 3D view of how the building changes. Tick the ones you want to pursue, reject the ones that don't fit the site, and add a note to remember why.

Once you're done, export the modified plan as a DWG and bring it back into your CAD program. The point is to draw once, with MMC built in — not to retrofit it after a CC reject.`;

await runHeyGenGenerator({
  module: "build",
  avatarId: DEFAULT_AVATAR_ID,
  voiceId: DEFAULT_VOICE_ID,
  script: SCRIPT,
  backgroundHex: DEFAULT_BACKGROUND_HEX,
  outputPath: join(process.cwd(), "public", "videos", "build-explainer.mp4"),
});
