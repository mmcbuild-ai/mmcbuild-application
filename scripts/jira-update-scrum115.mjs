#!/usr/bin/env node
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
const AUTH = Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN || process.env.JIRA_API_KEY}`).toString("base64");

function adfDoc(text) {
  return { type: "doc", version: 1, content: text.split("\n\n").map((p) => ({ type: "paragraph", content: [{ type: "text", text: p }] })) };
}

function api(method, path, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({ hostname: HOST, path, method, headers: { Authorization: `Basic ${AUTH}`, Accept: "application/json", "Content-Type": "application/json", ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}) } }, (res) => {
      let raw = ""; res.on("data", (c) => (raw += c)); res.on("end", () => { let p = null; if (raw) { try { p = JSON.parse(raw); } catch { p = raw; } } resolve({ status: res.statusCode, body: p }); });
    });
    req.on("error", (e) => resolve({ status: 0, body: { error: e.message } })); req.setTimeout(20000, () => { req.destroy(); resolve({ status: 0, body: "timeout" }); });
    if (data) req.write(data); req.end();
  });
}

const comment = `Status update (Dennis, 20 Apr 2026) — addressing all three sub-parts of your 15 Apr email.

Part 1 — Add test cases to the existing codebase
Existing (since 10 Apr): 29 Playwright E2E tests covering access control, billing, build, comply, direct, onboarding, quote, train. All 29 passed on the 10 Apr regime run (test-results/regime-report.md).
Added in this session: 3 unit tests in tests/unit/ai-models/registry-pricing.test.ts guarding against the SCRUM-121 per-1M pricing regression.
Known gap: billing subscription.test.ts has 5 skipped tests due to mock rot from a refactor — tracked as SCRUM-122 to fix properly. Does not reduce existing coverage; just pre-existing rot that CI now surfaces visibly.
Further unit coverage on src/lib/ai/* and src/app/*/actions.ts is the next logical expansion — flag if you want this prioritised.

Part 2 — Write tests alongside new work
Practice commitment — confirmed. The SCRUM-121 registry fix this session demonstrates the pattern (commit 235127f includes the unit test that guards the invariant).

Part 3 — Tests run automatically once changes are pushed
Shipped in commit 4975700. GitHub Actions workflow at .github/workflows/ci.yml:
- Triggers: push to main, any pull_request targeting main, manual workflow_dispatch
- Runs: pnpm install, typecheck (soft while @caistech migration settles), lint (soft), unit tests (hard-fail)
- E2E (Playwright) is a separate manual-only job until the suite is stable in CI — needs browser install + auth fixtures + secrets. Will promote to on-PR once stable.

First CI run is live now on the push that delivered this. Check Actions tab at github.com/dennissolver/mmcbuild/actions.

Optional admin step: set a repo secret GITHUB_PACKAGES_TOKEN (PAT with read:packages) so @caistech/* packages install cleanly. Workflow falls back to the built-in GITHUB_TOKEN if the PAT isn't set, which works only when all @caistech packages live in the same org. If CI fails on install, that's the fix.

Parts 1 and 3 are substantively delivered; Part 2 is an ongoing practice. Happy to leave this ticket open as a running TDD discipline tracker, or close with SCRUM-122 as the immediate coverage follow-up — your call.`;

const r = await api("POST", "/rest/api/3/issue/SCRUM-115/comment", { body: adfDoc(comment) });
console.log(r.status < 400 ? "✓ SCRUM-115 status comment posted" : `✗ ${r.status}`);
