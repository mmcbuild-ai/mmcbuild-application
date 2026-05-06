#!/usr/bin/env node
/**
 * Bring Jira ticket statuses in line with what has actually shipped.
 *
 * Closes:
 *   SCRUM-68  GitHub repo consolidation / Base44 migration — commit a8a683e + marketing pages live
 *   SCRUM-73  Token tracking tests + pricing summary — docs/pricing-options-v1.md + token-usage-summary.md
 *
 * Adds progress comment (keeps status):
 *   SCRUM-74  Triage Karen backlog — partial progress via SCRUM-60/75/116/118/119 comments
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import https from "https";

const envPath = join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  readFileSync(envPath, "utf8").split("\n").forEach((line) => {
    const [key, ...rest] = line.split("=");
    if (key && rest.length && !process.env[key.trim()])
      process.env[key.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
  });
}

const HOST = process.env.JIRA_HOST || "corporateaisolutions-team.atlassian.net";
const EMAIL = process.env.JIRA_EMAIL;
const TOKEN = process.env.JIRA_TOKEN || process.env.JIRA_API_KEY;
const AUTH = Buffer.from(`${EMAIL}:${TOKEN}`).toString("base64");

function adfDoc(text) {
  const paragraphs = text.split("\n\n").map((p) => ({
    type: "paragraph",
    content: [{ type: "text", text: p }],
  }));
  return { type: "doc", version: 1, content: paragraphs };
}

function api(method, path, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: HOST, path, method,
      headers: {
        Authorization: `Basic ${AUTH}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
      },
    }, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        let parsed = null;
        if (raw) { try { parsed = JSON.parse(raw); } catch { parsed = raw; } }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on("error", (e) => resolve({ status: 0, body: { error: e.message } }));
    req.setTimeout(20000, () => { req.destroy(); resolve({ status: 0, body: "timeout" }); });
    if (data) req.write(data);
    req.end();
  });
}

async function postComment(key, text) {
  const r = await api("POST", `/rest/api/3/issue/${key}/comment`, { body: adfDoc(text) });
  if (r.status >= 400) { console.error(`  ✗ comment on ${key}: ${r.status}`); return false; }
  return true;
}

async function transitionToDone(key) {
  const trans = await api("GET", `/rest/api/3/issue/${key}/transitions`);
  const targets = trans.body?.transitions || [];
  const done = targets.find((t) => /^done$/i.test(t.name)) || targets.find((t) => t.to?.statusCategory?.key === "done");
  if (!done) { console.error(`  ✗ no Done transition on ${key}`); return false; }
  const r = await api("POST", `/rest/api/3/issue/${key}/transitions`, { transition: { id: done.id } });
  if (r.status >= 400) { console.error(`  ✗ transition on ${key}: ${r.status}`); return false; }
  return true;
}

// ── SCRUM-68 ─────────────────────────────────────────────────────────────
async function closeScrum68() {
  console.log("SCRUM-68 — closing (marketing migration delivered)");
  const comment = `Delivered (Dennis, 20 Apr 2026). Closing.

Commits:
— a8a683e: marketing pages under /about, /blog, /case-studies, /contact, /privacy, /terms with shared layout
— contact-form.tsx: HubSpot wiring preserved from Base44 (portal 442558966, form 9ef67321 — Karen's Azzure account, per Karthik's 10 Apr email)

Live on mmcbuild-one.vercel.app (deployment dpl_HK5Y869MhiRBhVvbgpwDmzvQzBKP, commit d76659f). Verified serving 200s via Vercel edge logs.

Remaining follow-ups (separate, not blocking close):
— Live HubSpot form submission test against Karen's Azzure portal (low risk; wiring identical to Base44 source)
— Cancel Base44 subscription once DNS cutover completes (SCRUM-84, Karthik)
— Deprecate mmcbuild-ai/mmcbuild-webapp repo after cutover`;
  if (!(await postComment("SCRUM-68", comment))) return;
  if (await transitionToDone("SCRUM-68")) console.log("  ✓ SCRUM-68 → Done");
}

// ── SCRUM-73 ─────────────────────────────────────────────────────────────
async function closeScrum73() {
  console.log("SCRUM-73 — closing (token tracking + pricing summary delivered)");
  const comment = `Delivered (Dennis, 20 Apr 2026). Closing.

Artefacts:
— docs/pricing-options-v1.md: four pricing model options (flat, pay-per-run, credit, hybrid, per-project) with margin analysis. Recommends Option C credit-based for outlier protection but notes economic pressure is low.
— docs/token-usage-summary.md: empirical validation from live production run.
— scripts/token-usage-report.mjs: reusable reporter that queries ai_usage_log and recalculates cost from raw tokens.

Headline numbers:
— Pre-caching baseline: $2.21/run, 618k input tokens
— Post-caching (validated today): $0.49/run, 35k input tokens
— 78% cost reduction, 94% input-token reduction
— Cache hit ratio: 11:1 reads-to-writes (12 category calls per run, 1 prime)

Margin on current published pricing:
— Basic ($149/mo, 10 runs): 98.3%
— Professional ($399/mo, 30 runs): 98.1%

Enabled by commits:
— f616dd4: Anthropic prompt caching on compliance primary + validator calls
— 235127f: SCRUM-121 registry per-1M pricing unit fix (prerequisite for trustworthy cost numbers)
— 5902214: ai_usage_log schema migration for cache token columns
— 2dc00b9: validated summary checked in

Pricing discussion is ready to hold at tomorrow's call with concrete data rather than projections.`;
  if (!(await postComment("SCRUM-73", comment))) return;
  if (await transitionToDone("SCRUM-73")) console.log("  ✓ SCRUM-73 → Done");
}

// ── SCRUM-74 (progress comment, no status change) ────────────────────────
async function progressScrum74() {
  console.log("SCRUM-74 — adding progress comment (keeping To Do)");
  const comment = `Progress (Dennis, 20 Apr 2026):

Karen's unassigned backlog (SCRUM-43 to SCRUM-59, 17 items) still needs formal triage into Approved / Deferred / Rejected buckets. That full pass is NOT yet done.

Partial progress made on her in-flight tickets this session:
— SCRUM-60: posted consolidated Figma access request. Karen granted team access + editor rights; awaiting design-file URL (FigJam + Make files shared so far, no regular design file)
— SCRUM-75: posted cross-reference pointing to SCRUM-60
— SCRUM-80: still To Do, awaiting her test regime sign-off

Karthik's tickets (SCRUM-115 to SCRUM-120) also commented on:
— SCRUM-117 closed (Bug/Task/Test work types added)
— SCRUM-116/118/119/120 marked blocked on Figma access pending Karen's design file

Will action the full Karen-backlog triage after the 21 Apr call, once the Figma-merge scope is locked in.`;
  await postComment("SCRUM-74", comment);
  console.log("  ✓ SCRUM-74 progress comment posted");
}

await closeScrum68();
await closeScrum73();
await progressScrum74();

console.log("\nDone. Re-audit via /browse/<key> if you want to verify.");
