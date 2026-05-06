#!/usr/bin/env node
/**
 * Resolve SCRUM-183: post the cross-portfolio root-cause + fix as a comment,
 * include Karen's explicit retry instruction with expected UI behaviour,
 * then transition to Done.
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

const RESOLUTION = `Resolved.

Root cause was upstream of mmcbuild — the /derive Edge Function on the shared property-services Supabase was wrapped in withApiKey() middleware on 2026-04-30 (property-services commit d01ff9c). The SDK consumers (mmcbuild, F2K, DealFindrs) were still authenticating with the Supabase anon key only and didn't know about the new X-API-Key requirement, so every address pick returned 401.

Fix:
  • @caistech/property-services-sdk@0.3.0 published — sends X-API-Key, surfaces real server error messages instead of swallowing 401 bodies.
  • Issued enterprise-tier API keys for mmcbuild, F2K, DealFindrs in property-services api_keys.
  • Wired keys into Vercel env (NEXT_PUBLIC_PROPERTY_SERVICES_API_KEY) on all three projects.
  • Updated portfolio-manifest.yaml so portfolio-env-sync will catch this divergence in future.
  • Smoke-tested /derive with Karen's exact address (76 Brunswick St, Fortitude Valley) → HTTP 200 with full property profile.

Commits: cais-shared-services bee72b3, mmcbuild 78ee45b, F2K-Checkpoint ae7a0339, DealFindrs 594fe2b, property-services 6091953 + 68c9287.

Karen — please hard-refresh both F2K and mmcbuild (Ctrl+Shift+R) and try the same address pick. Expected behaviour: address selects from the dropdown, you see an "Analysing property…" spinner, then a green panel with zoning, wind region, climate zone, etc. No red "unauthorized" banner. If you still see the red banner after a hard refresh, please re-open this ticket with the response body from DevTools → Network → derive.`;

async function main() {
  console.log(`Resolving SCRUM-183 on ${HOST}\n`);

  // 1. Comment
  const c = await api("POST", `/rest/api/3/issue/SCRUM-183/comment`, { body: adfDoc(RESOLUTION) });
  if (c.status >= 400) {
    console.log(`  ✗ comment FAIL ${c.status}: ${JSON.stringify(c.body).slice(0, 200)}`);
    process.exit(1);
  }
  console.log(`  ✓ comment posted`);

  // 2. Transition to Done
  const t = await api("GET", `/rest/api/3/issue/SCRUM-183/transitions`);
  if (t.status >= 400) {
    console.log(`  ✗ transitions fetch FAIL ${t.status}`);
    process.exit(1);
  }
  const targets = t.body?.transitions || [];
  const chosen =
    targets.find((x) => /^done$/i.test(x.name)) ||
    targets.find((x) => x.to?.statusCategory?.key === "done") ||
    targets.find((x) => /close|resolve|complete/i.test(x.name));
  if (!chosen) {
    console.log(`  ✗ no Done transition available — names: ${targets.map(x => x.name).join(", ")}`);
    process.exit(1);
  }
  const r = await api("POST", `/rest/api/3/issue/SCRUM-183/transitions`, {
    transition: { id: chosen.id },
  });
  if (r.status >= 400) {
    console.log(`  ✗ transition FAIL ${r.status}: ${JSON.stringify(r.body).slice(0, 200)}`);
    process.exit(1);
  }
  console.log(`  ✓ transitioned → ${chosen.name}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
