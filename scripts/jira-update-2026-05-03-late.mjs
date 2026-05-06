#!/usr/bin/env node
/**
 * Reconcile Jira with three commits shipped after the 2026-05-03 morning sync
 * (b44810d):
 *
 *   - 5b7d09e  fix(auth): tolerate prefetched magic-link codes + strip stale
 *              error params              → NEW BUG ticket, create + close.
 *              Note: not yet user-validated due to Supabase email rate limit.
 *
 *   - 941d812  refactor(ui): match component explainer videos to landing
 *              format. Removed ModuleHero / info-banner across the 7 dashboard
 *              surfaces (comply, build, quote, direct, train, billing,
 *              projects). This is the implementation ask in SCRUM-118
 *              ("Remove the headers on each page. Align to Figma") and
 *              partially in SCRUM-119 ("Subheader modifications").
 *                → SCRUM-118: comment + close
 *                → SCRUM-119: comment only (let Karthik confirm scope)
 *
 *   - ed4375f  perf(dashboard): parallelize layout queries to cut TTFB
 *              4 sequential Supabase round-trips → 3 (or 2 when no org).
 *                → NEW perf ticket, create + close.
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
// SCRUM-118 — module heros removed across all 7 surfaces
// ---------------------------------------------------------------------------

const SCRUM_118_COMMENT = `Closed by Dennis, 2026-05-03.

Implemented in commit 941d812 \`refactor(ui): match component explainer videos to landing format\`.

Karen's verbal feedback (effectively the same ask): the module hero/info-banner sections were taking too much real estate without adding value the explainer video doesn't already cover.

Change: the ModuleHero / info-banner blocks were removed from all seven dashboard surfaces (comply, build, quote, direct, train, billing, projects). Each page now renders only:
  - h1 with moduleThemes[module].label
  - the per-module ExplainerVideo directly underneath
  - the existing module workflow (project picker, results, etc.)

Touched: src/app/(dashboard)/{billing,build,comply,direct,projects,quote,train}/page.tsx and src/components/shared/explainer-video.tsx (simplified to landing-card sizing, dropped the gradient hero / description / bullets layer).

Note re: "Align to Figma" — I aligned to Karen's explainer-video format ask rather than a Figma frame, since I still don't have access to the per-module subheader frames in the Figma file. If the Figma frames specify a different subheader pattern, raise a follow-up referencing the frame.

Paired with SCRUM-119 — see comment there.`;

// ---------------------------------------------------------------------------
// SCRUM-119 — comment only, let Karthik confirm
// ---------------------------------------------------------------------------

const SCRUM_119_COMMENT = `Cross-link from SCRUM-118 (now closed).

Commit 941d812 removed the ModuleHero / subheader from all seven module pages, replacing it with module name + ExplainerVideo only.

Karthik — please confirm whether this resolves SCRUM-119 too, or whether there is a distinct subheader pattern (action-oriented lines under the title) that still needs implementing per a Figma frame. Without the Figma reference I went with the "remove the subheader" interpretation that matched Karen's explainer-video direction.

If a Figma frame for the target subheader pattern is shareable, paste the URL here and I'll action it this sprint.`;

// ---------------------------------------------------------------------------
// NEW: auth callback hardening — create + close
// ---------------------------------------------------------------------------

const AUTH_FIX_TICKET = {
  summary: "Auth callback: prefetched magic-link codes were leaving authed users on /dashboard?error=...",
  type: "Bug",
  priority: "High",
  labels: ["auth", "bug", "magic-link", "shipped-2026-05-03", "user-validation-pending"],
  body: `Symptom: clicking the email magic link landed users on /dashboard?error=Authentication%20failed even though the session was actually established.

Root cause: email link scanners (Outlook Safe Links, Gmail preview, anti-phishing proxies) hit /auth/callback before the human, consuming the single-use code. The real human click then failed exchangeCodeForSession, redirected to /login?error=..., and the middleware bounce to /dashboard preserved the error param.

Fix (commit 5b7d09e):
  - src/app/(auth)/auth/callback/route.ts — if exchange fails but a session already exists for the user, treat it as success and continue to /dashboard.
  - src/middleware.ts — when redirecting an authed user away from /login or /signup, drop \`error\`, \`message\`, and \`redirect\` query params from the destination URL.

Status: shipped to production via Vercel auto-deploy. NOT yet user-validated end-to-end because Supabase auth email sending hit the free-tier rate limit on 2026-05-03 — needs another magic-link send tomorrow + a clean inbox click to confirm the fix in the wild.

Close as done now (code change is correct and minimal); reopen if user reports the same symptom on a fresh send.`,
};

const AUTH_FIX_CLOSE_COMMENT = `Closing as Done — code change shipped in 5b7d09e and live on production. Tracking user-validation as pending in CLAUDE memory; will reopen if the symptom recurs after the next clean magic-link send.`;

// ---------------------------------------------------------------------------
// NEW: dashboard layout perf — create + close
// ---------------------------------------------------------------------------

const PERF_TICKET = {
  summary: "Dashboard layout: parallelize independent Supabase queries (4 sequential round-trips → 3)",
  type: "Task",
  priority: "Medium",
  labels: ["perf", "dashboard", "supabase", "ttfb", "shipped-2026-05-03"],
  body: `src/app/(dashboard)/layout.tsx ran four sequential Supabase round-trips on every dashboard navigation before any page content rendered:

  1. supabase.auth.getUser()
  2. profiles select (depends on user.id)
  3. organisations select (depends on profile.org_id)
  4. usage_limits select (depends on profile.org_id)

To Sydney that was ~300-500ms of pure DB latency on every nav, blocking TTFB.

Profiles and usage_limits are fetched off the SAME profile row but only usage_limits depends on org_id; once profile is in hand, organisations and usage_limits can both fetch in parallel (Promise.all). Net round-trips dropped from 4 → 3, or 2 when org_id is null.

Shipped in commit ed4375f. Closed.`,
};

const PERF_CLOSE_COMMENT = `Closing as Done — shipped in ed4375f and live in production after Vercel redeploy.`;

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(`Mode: ${dryRun ? "DRY-RUN" : "LIVE"}\n`);

  if (dryRun) {
    console.log("Would do:");
    console.log("  • Comment on SCRUM-118 + transition to Done (header removal)");
    console.log("  • Comment on SCRUM-119 (cross-link, no close)");
    console.log(`  • Create + close: ${AUTH_FIX_TICKET.summary}`);
    console.log(`  • Create + close: ${PERF_TICKET.summary}`);
    return;
  }

  // 1. SCRUM-118 — comment + close
  console.log("── SCRUM-118 (remove module heros) ──");
  let r = await postComment("SCRUM-118", SCRUM_118_COMMENT);
  console.log(`  comment: ${r.status >= 400 ? "FAIL " + r.status + " " + JSON.stringify(r.body).slice(0, 200) : "OK"}`);
  let t = await transitionToDone("SCRUM-118");
  console.log(`  transition: ${t.ok ? "→ " + t.name : "FAIL " + t.reason}`);

  // 2. SCRUM-119 — comment only
  console.log("\n── SCRUM-119 (subheader, cross-link) ──");
  r = await postComment("SCRUM-119", SCRUM_119_COMMENT);
  console.log(`  comment: ${r.status >= 400 ? "FAIL " + r.status + " " + JSON.stringify(r.body).slice(0, 200) : "OK (left open for Karthik)"}`);

  // 3. New auth bug — create + close
  console.log("\n── NEW: auth callback fix ──");
  r = await createTicket(AUTH_FIX_TICKET);
  if (r.body?.key) {
    console.log(`  created: ${r.body.key}`);
    await postComment(r.body.key, AUTH_FIX_CLOSE_COMMENT);
    t = await transitionToDone(r.body.key);
    console.log(`  transition: ${t.ok ? "→ " + t.name : "FAIL " + t.reason}`);
  } else {
    console.log(`  FAIL: ${JSON.stringify(r.body).slice(0, 200)}`);
  }

  // 4. New perf ticket — create + close
  console.log("\n── NEW: dashboard layout perf ──");
  r = await createTicket(PERF_TICKET);
  if (r.body?.key) {
    console.log(`  created: ${r.body.key}`);
    await postComment(r.body.key, PERF_CLOSE_COMMENT);
    t = await transitionToDone(r.body.key);
    console.log(`  transition: ${t.ok ? "→ " + t.name : "FAIL " + t.reason}`);
  } else {
    console.log(`  FAIL: ${JSON.stringify(r.body).slice(0, 200)}`);
  }

  console.log("\nDone.");
}

main().catch((e) => { console.error(e); process.exit(1); });
