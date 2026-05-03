#!/usr/bin/env node
/**
 * Reconcile Jira with the 2026-05-03 video + migration work:
 *
 *   - SCRUM-177 (HeyGen explainer videos)  → comment with completion summary,
 *                                             transition to Done. Covers all 7
 *                                             module videos + the wiring on
 *                                             Direct/Train/Billing/Projects +
 *                                             the new `projects` module theme.
 *
 *   - NEW TICKET (overview explainer)      → create + immediately close as done.
 *                                             Public landing page got a ~100s
 *                                             persuasive walkthrough between
 *                                             the hero CTA and modules grid.
 *                                             Not in any prior ticket scope.
 *
 *   - SCRUM-166 / SCRUM-167                → comment confirming migration 00042
 *                                             applied to live DB + types
 *                                             regenerated + deployed. The
 *                                             interactive decisions feature is
 *                                             now functional end-to-end.
 *
 *   - NEW TICKET (modules-count copy)      → create as TODO. Landing page still
 *                                             reads "Six Modules. One Platform."
 *                                             — Projects is a 7th surface and
 *                                             Billing arguably 8th. Marketing
 *                                             copy decision pending.
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import https from "https";

const envPath = join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  readFileSync(envPath, "utf8").split("\n").forEach((line) => {
    const [k, ...r] = line.split("=");
    if (k && r.length && !process.env[k.trim()])
      process.env[k.trim()] = r.join("=").trim().replace(/^["']|["']$/g, "");
  });
}

const HOST = process.env.JIRA_HOST || "corporateaisolutions-team.atlassian.net";
const PROJECT_KEY = process.env.JIRA_PROJECT || "SCRUM";
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

async function transitionToDone(key) {
  const trans = await api("GET", `/rest/api/3/issue/${key}/transitions`);
  if (trans.status >= 400) return { ok: false, reason: "fetch transitions failed" };
  const targets = trans.body.transitions || [];
  const chosen =
    targets.find((t) => /^done$/i.test(t.name)) ||
    targets.find((t) => t.to?.statusCategory?.key === "done") ||
    targets.find((t) => /close|resolve|complete/i.test(t.name));
  if (!chosen) return { ok: false, reason: "no Done transition" };
  const r = await api("POST", `/rest/api/3/issue/${key}/transitions`, {
    transition: { id: chosen.id },
  });
  if (r.status >= 400) return { ok: false, reason: `transition ${r.status}` };
  return { ok: true, name: chosen.name };
}

async function createTicket(t) {
  return api("POST", "/rest/api/3/issue", {
    fields: {
      project: { key: PROJECT_KEY },
      summary: t.summary,
      description: adfDoc(t.body),
      issuetype: { name: t.type },
      labels: t.labels,
      priority: { name: t.priority },
    },
  });
}

// ---------------------------------------------------------------------------
// SCRUM-177 — HeyGen explainer videos: completion comment + close
// ---------------------------------------------------------------------------

const SCRUM_177_COMPLETION = `Closed by Dennis, 2026-05-03.

All seven MMC platform surfaces now play a HeyGen-rendered explainer on their landing page. Same avatar (Amelia, Business Training Front) and voice (Hope, professional female English) across the set for visual + audio consistency.

Videos rendered (Public Avatar III tier, ~$1 each, ~$7 total):
  - public/videos/build-explainer.mp4    (commit a239451)
  - public/videos/comply-explainer.mp4   (commit ce8894a)
  - public/videos/quote-explainer.mp4    (commit ce8894a)
  - public/videos/direct-explainer.mp4   (commit ce8894a)
  - public/videos/train-explainer.mp4    (commit ce8894a)
  - public/videos/projects-explainer.mp4 (commit ce8894a)
  - public/videos/billing-explainer.mp4  (commit ce8894a)

Generator scripts (re-runnable any time the script copy changes):
  - scripts/heygen-generate-{build,comply,quote,direct,train,projects,billing}-explainer.mjs
  - Shared helper: scripts/heygen/_lib.mjs
  - TS client (for future server-side use): src/lib/heygen/client.ts

Module page wiring:
  - /build, /comply, /quote — landing pages already had ExplainerVideo from SCRUM-164; videoUrl props now point at the rendered MP4s
  - /direct, /train, /billing — added ExplainerVideo below the existing ModuleHero
  - /projects — added ExplainerVideo (no prior hero); new \`projects\` entry added to module-themes.ts (FolderOpen icon, sky gradient)

Defaults set in .env.local + Vercel envars:
  - HEYGEN_DEFAULT_AVATAR_ID=Amelia_standing_business_training_front
  - HEYGEN_DEFAULT_VOICE_ID=42d00d4aac5441279d8536cd6b52c53c

Public landing page overview video tracked separately (raised today).`;

// ---------------------------------------------------------------------------
// NEW: Public landing overview video — create + close
// ---------------------------------------------------------------------------

const OVERVIEW_TICKET = {
  summary: "Public landing page: ~100s overview explainer between hero and modules grid",
  type: "Story",
  priority: "Medium",
  labels: ["public-site", "landing", "media", "heygen", "marketing", "shipped-2026-05-03"],
  body: `Cold prospects landing on mmcbuild-one.vercel.app/ now see a ~100s persuasive walkthrough between the hero CTA and the "Six Modules. One Platform." grid.

Different from the in-app per-module explainers (SCRUM-177): this one targets users who don't yet have an account, hooks on the design-rework friction architects face, walks the full Project → Comply → Build → Quote → Direct → Train workflow in one breath, and ends on the trial CTA.

Same Amelia (Business Training Front) avatar + Hope voice as SCRUM-177 for brand consistency.

Shipped:
  - public/videos/overview-explainer.mp4   (~11MB, ~100s)
  - public/videos/overview-poster.jpg      (57KB, frame at 1s — shown before play)
  - scripts/heygen-generate-overview-explainer.mjs
  - src/app/page.tsx — new <section> with the player, sits between hero and modules grid

Commit e842aff. Cost ~$1-2 (Public Avatar III, ~100s).

Re-render via: \`node scripts/heygen-generate-overview-explainer.mjs\``,
};

const OVERVIEW_COMPLETION_COMMENT = `Completed in commit e842aff on 2026-05-03. Live on mmcbuild-one.vercel.app/ after Vercel redeploy.`;

// ---------------------------------------------------------------------------
// SCRUM-166 / SCRUM-167 — migration applied + types regenerated (cross-link)
// ---------------------------------------------------------------------------

const SCRUM_166_MIGRATION_COMMENT = `Migration applied to live database 2026-05-03 via \`supabase db push\`:
  - design_suggestions.decision (suggestion_decision enum, NOT NULL DEFAULT 'undecided')
  - design_suggestions.decision_note (text, nullable)
  - design_suggestions.decided_by (uuid → profiles.id, nullable)
  - design_suggestions.decided_at (timestamptz, nullable)
  - idx_design_suggestions_decision (composite check_id + decision)
  - "Users can update own org design suggestions" RLS policy (org-scoped UPDATE via design_checks join)

Types regenerated via \`supabase gen types typescript --linked > src/lib/supabase/types.ts\` and committed in c09cc0a (custom enum exports preserved). The interactive decision UI is now functional end-to-end on production.`;

// ---------------------------------------------------------------------------
// NEW: marketing copy update (modules-count) — create as TODO
// ---------------------------------------------------------------------------

const MARKETING_COPY_TICKET = {
  summary: "Public landing: \"Six Modules. One Platform.\" copy now stale (Projects = 7th surface, Billing arguably 8th)",
  type: "Task",
  priority: "Low",
  labels: ["public-site", "landing", "marketing", "copy", "needs-decision"],
  body: `src/app/page.tsx line 91-93 still reads:

  "Six Modules. One Platform."
  "Everything an Australian residential builder needs — from compliance to costing to crew."

After SCRUM-177 the platform surfaces an in-app ExplainerVideo on /projects and /billing too — making the in-app footprint 7 surfaces (Projects + 5 modules + Billing) or 8 if you treat Billing as a module.

Decision needed: how do we want to frame the count on the marketing page?
  Option 1 — Update to "Seven Modules" or "Seven Surfaces" (literal)
  Option 2 — Re-phrase to avoid a number ("One Platform. Every Stage." or similar)
  Option 3 — Keep "Six Modules" because Projects is the foundation (not a module) and Billing is subscription management (not a module). The landing page lists 6 module cards.

Light scope. Defer until marketing copy review or until next homepage refresh.`,
};

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(`Mode: ${dryRun ? "DRY-RUN" : "LIVE"}\n`);

  if (dryRun) {
    console.log("Would do:");
    console.log("  • Comment on SCRUM-177, transition to Done");
    console.log(`  • Create + close: ${OVERVIEW_TICKET.summary}`);
    console.log("  • Comment on SCRUM-166 (migration applied + types regen)");
    console.log("  • Comment on SCRUM-167 (decisions feature live end-to-end)");
    console.log(`  • Create as TODO: ${MARKETING_COPY_TICKET.summary}`);
    return;
  }

  // 1. SCRUM-177 — comment + close
  console.log("── SCRUM-177 (HeyGen videos) ──");
  let r = await postComment("SCRUM-177", SCRUM_177_COMPLETION);
  console.log(`  comment: ${r.status >= 400 ? "FAIL " + r.status : "OK"}`);
  let t = await transitionToDone("SCRUM-177");
  console.log(`  transition: ${t.ok ? "→ " + t.name : "FAIL " + t.reason}`);

  // 2. New overview ticket — create + close
  console.log("\n── NEW: overview explainer ──");
  r = await createTicket(OVERVIEW_TICKET);
  if (r.body?.key) {
    console.log(`  created: ${r.body.key}`);
    await postComment(r.body.key, OVERVIEW_COMPLETION_COMMENT);
    t = await transitionToDone(r.body.key);
    console.log(`  transition: ${t.ok ? "→ " + t.name : "FAIL " + t.reason}`);
  } else {
    console.log(`  FAIL: ${JSON.stringify(r.body).slice(0, 200)}`);
  }

  // 3. SCRUM-166 + SCRUM-167 — migration cross-link
  console.log("\n── SCRUM-166 / SCRUM-167 (migration applied) ──");
  for (const k of ["SCRUM-166", "SCRUM-167"]) {
    r = await postComment(k, SCRUM_166_MIGRATION_COMMENT);
    console.log(`  ${k} comment: ${r.status >= 400 ? "FAIL " + r.status : "OK"}`);
  }

  // 4. Marketing copy ticket — create as TODO (no close)
  console.log("\n── NEW: marketing copy update (TODO) ──");
  r = await createTicket(MARKETING_COPY_TICKET);
  if (r.body?.key) {
    console.log(`  created: ${r.body.key} (left as To Do)`);
  } else {
    console.log(`  FAIL: ${JSON.stringify(r.body).slice(0, 200)}`);
  }

  console.log("\nDone.");
}

main().catch((e) => { console.error(e); process.exit(1); });
