#!/usr/bin/env node
/**
 * Generate the MMC Train module explainer video via HeyGen.
 *
 * Output: public/videos/train-explainer.mp4
 * Cost:   ~$1 per render (Public Avatar III tier, ~60s clip)
 *
 * Usage:
 *   node scripts/heygen-generate-train-explainer.mjs --list-avatars
 *   node scripts/heygen-generate-train-explainer.mjs --list-voices
 *   node scripts/heygen-generate-train-explainer.mjs
 *   node scripts/heygen-generate-train-explainer.mjs --avatar <id> --voice <id>
 *   node scripts/heygen-generate-train-explainer.mjs --dry-run
 */
import { join } from "path";
import {
  runHeyGenGenerator,
  DEFAULT_AVATAR_ID,
  DEFAULT_VOICE_ID,
  DEFAULT_BACKGROUND_HEX,
} from "./heygen/_lib.mjs";

// ~150 words. ICP: architects/designers/certifiers who haven't designed in
// MMC before. The pitch is "short, role-relevant, gets you specifying".
const SCRIPT = `MMC Train is short-form upskilling on Modern Methods of Construction, built for architects, designers, certifiers, and builders who haven't worked with MMC before.

Pick your role and Train gives you the modules that actually matter for what you do. Designers get assembly detailing, span tables, and how MMC affects FSR and landscape calculations. Certifiers get the compliance pathway differences and what evidence to ask for. Builders get site setup, crane logistics, and trade sequencing.

Each module is short — fifteen to twenty minutes — with worked examples from real Australian projects. Finish a module, take the quiz, get a certificate you can list on your professional profile.

The goal isn't theoretical knowledge. It's getting you confident enough to specify MMC on your next project, brief your team, or sign off a CC without hedging — by the time you finish your first cup of coffee.`;

await runHeyGenGenerator({
  module: "train",
  avatarId: DEFAULT_AVATAR_ID,
  voiceId: DEFAULT_VOICE_ID,
  script: SCRIPT,
  backgroundHex: DEFAULT_BACKGROUND_HEX,
  outputPath: join(process.cwd(), "public", "videos", "train-explainer.mp4"),
});
