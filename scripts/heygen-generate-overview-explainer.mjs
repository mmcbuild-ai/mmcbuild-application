#!/usr/bin/env node
/**
 * Generate the public-landing-page OVERVIEW explainer video via HeyGen.
 *
 * Output: public/videos/overview-explainer.mp4
 * Cost:   ~$1-2 per render (Public Avatar III tier, ~90s clip)
 *
 * Different from the per-module explainers: this one is for COLD prospects
 * landing on mmcbuild-one.vercel.app/. Persuasive arc, ~90s, walks the full
 * Project → Comply → Build → Quote → Direct → Train workflow in one breath.
 *
 * Usage:
 *   node scripts/heygen-generate-overview-explainer.mjs
 *   node scripts/heygen-generate-overview-explainer.mjs --avatar <id> --voice <id>
 *   node scripts/heygen-generate-overview-explainer.mjs --dry-run
 */
import { join } from "path";
import {
  runHeyGenGenerator,
  DEFAULT_AVATAR_ID,
  DEFAULT_VOICE_ID,
  DEFAULT_BACKGROUND_HEX,
} from "./heygen/_lib.mjs";

// ~225 words, ~100s at conversational pace. Persuasive, not educational.
// Targets architects and designers in concept/schematic stage who haven't
// yet committed to a construction methodology. Avoids jargon dumps.
const SCRIPT = `If you're an architect or designer working on a residential project in Australia, you already know the friction. Concept drawings get locked in. Then comes NCC compliance. Then a builder pushes back on cost. Then someone mentions Modern Methods of Construction — prefab, panelised, modular — and suddenly you're redrawing the whole thing.

MMC Build is built to fix that. One platform that takes you from concept to council submission with MMC designed in from the start, not retrofitted at the end.

Set up your project once — drop in the address, your plans, and what you want to achieve. We auto-derive your climate zone, wind region, and council, and share that data across every module.

Run Comply to check your design against the right NCC pathway for the construction methodology you're choosing. Run Build to see which prefab, SIP, CLT, or modular elements would actually pay back on this project, with cost and time impact for each. Run Quote to get real numbers from verified Australian suppliers — pick three, compare side by side. Find those suppliers in MMC Direct, with their compliance documents already verified. And upskill your team in MMC Train when you need to.

Ten free runs on the trial. No credit card. Try it on the project you're working on right now, while the drawings are still flexible.`;

await runHeyGenGenerator({
  module: "build", // module key only used for output formatting; overview lives at root
  avatarId: DEFAULT_AVATAR_ID,
  voiceId: DEFAULT_VOICE_ID,
  script: SCRIPT,
  backgroundHex: DEFAULT_BACKGROUND_HEX,
  outputPath: join(process.cwd(), "public", "videos", "overview-explainer.mp4"),
});
