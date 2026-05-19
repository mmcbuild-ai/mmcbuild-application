#!/usr/bin/env node
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
const AUTH = Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN || process.env.JIRA_API_KEY}`).toString("base64");

function api(method, path, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: HOST, path, method,
      headers: {
        Authorization: `Basic ${AUTH}`, Accept: "application/json", "Content-Type": "application/json",
        ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
      },
    }, (res) => {
      let raw = "";
      res.on("data", (c) => raw += c);
      res.on("end", () => { let parsed = null; if (raw) { try { parsed = JSON.parse(raw); } catch { parsed = raw; } } resolve({ status: res.statusCode, body: parsed }); });
    });
    req.on("error", (e) => resolve({ status: 0, body: { error: e.message } }));
    req.setTimeout(20000, () => { req.destroy(); resolve({ status: 0, body: "timeout" }); });
    if (data) req.write(data);
    req.end();
  });
}
function adfDoc(text) {
  return { type: "doc", version: 1, content: text.split("\n\n").map((p) => ({ type: "paragraph", content: [{ type: "text", text: p }] })) };
}

const COMMENT = `Done. Doc lives at docs/process-guardrails.md (committed on main).

Sections:
1. Risk tier (REGULATED) and what that classification means
2. Branch model + code review (the feature → release → main flow we agreed on 2026-05-06)
3. Read-before-edit + change discipline
4. Authentication (Supabase getUser pattern)
5. Authorisation, RLS, and the three Supabase client surfaces (server / db / admin / client)
6. Paywall double-layer (middleware + Server Action)
7. AI safety (callModel router + security-gate)
8. Webhook signature verification (Stripe + GitHub)
9. Token-based public endpoints (/api/remediation/[token])
10. Input validation (Zod, per-module validators.ts)
11. Secrets and environment variables
12. Async / long-running work (Inngest)
13. Testing (Vitest + Playwright + Test Regime v1.0)
14. Deployment and observability — includes the Sydney data-residency point you'll want for the VC pack
15. Known gaps / deferred items (the section a VC will appreciate most — explicit list of what isn't yet enforced)
16. Where to verify each claim in the repo

Cross-check pointer: every architectural claim is mapped to a file/path in the repo so you can spot-check anything you want for the VC pack (SCRUM-205). I already did one round of spot-checking and corrected one CLAUDE.md drift in the process (validators are per-module at src/lib/<module>/validators.ts, not under a single src/lib/validators/ directory).

If you spot any drift between this doc and the actual code, please flag it back to me — code wins, and I'll update the doc.`;

const c = await api("POST", `/rest/api/3/issue/SCRUM-198/comment`, { body: adfDoc(COMMENT) });
console.log(`Comment: status ${c.status}`);

const tr = await api("GET", `/rest/api/3/issue/SCRUM-198/transitions`);
const done = (tr.body?.transitions || []).find((t) => /^done$/i.test(t.name));
if (done) {
  const tx = await api("POST", `/rest/api/3/issue/SCRUM-198/transitions`, { transition: { id: done.id } });
  console.log(`Transition -> Done: status ${tx.status}`);
}
