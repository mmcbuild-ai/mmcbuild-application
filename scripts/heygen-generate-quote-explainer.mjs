#!/usr/bin/env node
/**
 * Generate the MMC Quote module explainer video via HeyGen.
 *
 * Output: public/videos/quote-explainer.mp4
 * Cost:   ~$1 per render (Public Avatar III tier, ~60s clip)
 *
 * Usage:
 *   node scripts/heygen-generate-quote-explainer.mjs --list-avatars
 *   node scripts/heygen-generate-quote-explainer.mjs --list-voices
 *   node scripts/heygen-generate-quote-explainer.mjs
 *   node scripts/heygen-generate-quote-explainer.mjs --avatar <id> --voice <id>
 *   node scripts/heygen-generate-quote-explainer.mjs --dry-run
 */
import { join } from "path";
import {
  runHeyGenGenerator,
  DEFAULT_AVATAR_ID,
  DEFAULT_VOICE_ID,
  DEFAULT_BACKGROUND_HEX,
} from "./heygen/_lib.mjs";

// ~150 words. ICP: architects and designers building a cost case for the
// client; comparing MMC against traditional stick build.
const SCRIPT = `MMC Quote turns the design choices you made in MMC Build into actual numbers — so you can have a cost conversation with the client backed by current Australian supplier rates, not industry averages.

Pick the suggestions you're pursuing and Quote runs them against rate data from real prefab, panel, and modular suppliers. You'll see the cost delta against a traditional stick build, the lead time on each component, and where the savings actually come from — labour on site, programme weeks, material wastage, or all three.

You can also pick up to three suppliers per component and get parallel quotes, so the client sees the spread.

Export the result as a PDF or Word document for the client, the builder, and the project file. Then take the conversation back to design with hard numbers, not estimates.`;

await runHeyGenGenerator({
  module: "quote",
  avatarId: DEFAULT_AVATAR_ID,
  voiceId: DEFAULT_VOICE_ID,
  script: SCRIPT,
  backgroundHex: DEFAULT_BACKGROUND_HEX,
  outputPath: join(process.cwd(), "public", "videos", "quote-explainer.mp4"),
});
