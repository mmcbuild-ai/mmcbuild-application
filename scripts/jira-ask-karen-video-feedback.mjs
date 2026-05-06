#!/usr/bin/env node
/**
 * Ask Karen for feedback on the explainer videos that shipped 2026-05-03.
 *
 *   - SCRUM-177  per-module explainers across the 7 in-app surfaces
 *   - SCRUM-179  public landing overview explainer (~100s)
 *
 * Both tickets are already Done. These comments are review-asks, not status changes.
 *
 * Run: node scripts/jira-ask-karen-video-feedback.mjs [--dry-run]
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import https from "https";

const envPath = join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  readFileSync(envPath, "utf8").split("\n").forEach((line) => {
    const [k, ...r] = line.split("=");
    if (k && r.length && !process.env[k.trim()]) {
      let v = r.join("=").trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[k.trim()] = v;
    }
  });
}

const HOST = process.env.JIRA_HOST || "corporateaisolutions-team.atlassian.net";
const AUTH = Buffer.from(
  `${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN || process.env.JIRA_API_KEY}`,
).toString("base64");

function adfDoc(text) {
  return {
    type: "doc",
    version: 1,
    content: text.split("\n\n").map((p) => ({
      type: "paragraph",
      content: [{ type: "text", text: p }],
    })),
  };
}

function api(method, path, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        hostname: HOST,
        path,
        method,
        headers: {
          Authorization: `Basic ${AUTH}`,
          Accept: "application/json",
          ...(data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          let parsed = null;
          if (raw) { try { parsed = JSON.parse(raw); } catch { parsed = raw; } }
          resolve({ status: res.statusCode, body: parsed });
        });
      },
    );
    req.on("error", (e) => resolve({ status: 0, body: { error: e.message } }));
    req.setTimeout(20000, () => { req.destroy(); resolve({ status: 0, body: "timeout" }); });
    if (data) req.write(data);
    req.end();
  });
}

async function postComment(key, body) {
  return api("POST", `/rest/api/3/issue/${key}/comment`, { body: adfDoc(body) });
}

const SCRUM_177_REVIEW_REQUEST = `Hi Karen — videos are live. Could you spend ~10 minutes reviewing them and leaving notes on this ticket?

Where to look (login required):
  • /comply       https://mmcbuild-one.vercel.app/comply
  • /build        https://mmcbuild-one.vercel.app/build
  • /quote        https://mmcbuild-one.vercel.app/quote
  • /direct       https://mmcbuild-one.vercel.app/direct
  • /train        https://mmcbuild-one.vercel.app/train
  • /projects     https://mmcbuild-one.vercel.app/projects
  • /billing      https://mmcbuild-one.vercel.app/billing

What I'd like your eye on specifically:

1. Avatar + voice consistency. Same Amelia (Business Training Front) + Hope voice across all 7. Does the persona feel right for an architect/designer audience, or does it skew too generic-corporate?

2. Player placement and visual weight. The player sits below ModuleHero on most pages and above the modules grid on /projects. Does it compete with the page's primary content, or sit cleanly in the flow?

3. Script content per module. Each script was written from the module's value prop. If anything is inaccurate, oversells, or undersells against what the module actually does, flag the module + timestamp.

4. Pacing and length. Each video runs ~60-90s. Too long? Too short? Anywhere it drags?

5. Captions / accessibility. Currently no captions track. Worth adding before client demos, or fine for now?

6. Anything else that would stop you from showing this to a target architect on a sales call.

Happy to re-render any/all of them — the generator scripts are checked in (scripts/heygen-generate-*-explainer.mjs) so iteration is cheap. ~$1/video.`;

const SCRUM_179_REVIEW_REQUEST = `Hi Karen — public landing overview is live. Could you review and comment?

Where to look (no login needed — this is the public marketing page):
  https://mmcbuild-one.vercel.app/

The video sits between the hero CTA and the "Six Modules. One Platform." grid. ~100s walkthrough framed for cold architects/designers landing on the site for the first time.

What I'd value your read on:

1. Hook in the first 10 seconds. Does it grab a designer/architect who's never heard of MMC Build, or do they bounce?

2. Story arc. Walks Project → Comply → Build → Quote → Direct → Train in one breath. Does it land as a coherent workflow, or feel like a feature checklist?

3. Tone vs your visual brand direction. Same Amelia avatar + Hope voice as the in-app explainers. Does it feel on-brand for the site we're building toward, or fight the visual language in your Figma?

4. CTA framing. Ends on the trial/signup CTA. Is the call-to-action clear and well-placed, or does the video need a stronger close?

5. Length. ~100s. Right length for a landing-page hero-adjacent explainer?

6. Whether this should auto-play (currently click-to-play with a poster frame).

Cheap to re-render (~$1, ~5 minutes via scripts/heygen-generate-overview-explainer.mjs). If the script copy needs work, paste a revision into this ticket and I'll re-render.

Related: there's a small open marketing-copy ticket about whether "Six Modules. One Platform." still reads correctly now that Projects + Billing also have explainer videos. Your view on that would also be welcome.`;

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(`Mode: ${dryRun ? "DRY-RUN" : "LIVE"}`);
  console.log(`Host: ${HOST}\n`);

  if (dryRun) {
    console.log("Would post comments:");
    console.log("  • SCRUM-177 — per-module explainer review request (~7 surfaces)");
    console.log("  • SCRUM-179 — public landing overview review request");
    return;
  }

  const targets = [
    { key: "SCRUM-177", body: SCRUM_177_REVIEW_REQUEST },
    { key: "SCRUM-179", body: SCRUM_179_REVIEW_REQUEST },
  ];

  let ok = 0;
  for (const { key, body } of targets) {
    const r = await postComment(key, body);
    if (r.status >= 400) {
      console.log(`  ✗ ${key} — ${r.status}: ${JSON.stringify(r.body).slice(0, 200)}`);
    } else {
      console.log(`  ✓ ${key} — feedback request posted`);
      ok++;
    }
  }
  console.log(`\n${ok}/${targets.length} comments posted.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
