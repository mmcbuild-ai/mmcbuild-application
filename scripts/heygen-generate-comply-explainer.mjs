#!/usr/bin/env node
/**
 * Generate the MMC Comply module explainer video via HeyGen.
 *
 * Output: public/videos/comply-explainer.mp4
 * Cost:   ~$1 per render (Public Avatar III tier, ~60s clip)
 *
 * Usage:
 *   node scripts/heygen-generate-comply-explainer.mjs --list-avatars
 *   node scripts/heygen-generate-comply-explainer.mjs --list-voices
 *   node scripts/heygen-generate-comply-explainer.mjs
 *   node scripts/heygen-generate-comply-explainer.mjs --avatar <id> --voice <id>
 *   node scripts/heygen-generate-comply-explainer.mjs --dry-run
 */
import { join } from "path";
import {
  runHeyGenGenerator,
  DEFAULT_AVATAR_ID,
  DEFAULT_VOICE_ID,
  DEFAULT_BACKGROUND_HEX,
} from "./heygen/_lib.mjs";

// ~150 words. ICP: architects and designers documenting for DA / CC.
const SCRIPT = `MMC Comply is the compliance check for designers using Modern Methods of Construction. Volumetric, panelised, hybrid — each runs through its own NCC pathway, with different deemed-to-satisfy clauses and different certification trails.

Upload your drawings and Comply maps every assembly to the right pathway, flags where evidence is missing, and lists the certificates the certifier will ask for at lodgement. Factory-built elements need certs from the factory and the assembler — Comply tells you exactly which ones to call up on the drawings.

The output is a structured findings report you can hand straight to your certifier, plus a sharable PDF or Word export for the client and the project file.

Run it during design, not after submission. A wrong pathway during documentation is cheap to fix; a CC reject is not.`;

await runHeyGenGenerator({
  module: "comply",
  avatarId: DEFAULT_AVATAR_ID,
  voiceId: DEFAULT_VOICE_ID,
  script: SCRIPT,
  backgroundHex: DEFAULT_BACKGROUND_HEX,
  outputPath: join(process.cwd(), "public", "videos", "comply-explainer.mp4"),
});
