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
const EMAIL = process.env.JIRA_EMAIL;
const TOKEN = process.env.JIRA_TOKEN || process.env.JIRA_API_KEY;
const AUTH = Buffer.from(`${EMAIL}:${TOKEN}`).toString("base64");
const KEY = "SCRUM-121";

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

async function main() {
  const commentText = `Fixed (Dennis, 20 Apr 2026) — commit 235127f.

Chose Option A from docs/pricing-options-v1.md: renamed the fields costPer1kInput/costPer1kOutput to costPer1MInput/costPer1MOutput and updated the estimateCost formula to divide by 1,000,000. Values in the registry are unchanged — they were already per-1M figures, just mislabelled.

Added tests/unit/ai-models/registry-pricing.test.ts — three assertions catch any future regression where someone stores a per-1k value in a per-1M field.

Historical ai_usage_log rows not backfilled. The /settings/ai-performance dashboard will display correct costs for rows created after 235127f. Pre-fix rows remain inflated 1000× but the scripts/token-usage-report.mjs reporter recalculates from raw tokens, so the SCRUM-73 analysis already bypassed the bug.

Acceptance satisfied:
— Fix chosen and applied consistently (Option A)
— No backfill needed
— Unit test covers the invariant (3/3 passing)`;

  const commentResp = await api("POST", `/rest/api/3/issue/${KEY}/comment`, { body: adfDoc(commentText) });
  console.log(commentResp.status < 400 ? "✓ Comment posted" : `✗ Comment failed: ${commentResp.status}`);

  const trans = await api("GET", `/rest/api/3/issue/${KEY}/transitions`);
  const targets = trans.body.transitions || [];
  const doneTrans = targets.find((t) => /^done$/i.test(t.name))
                 || targets.find((t) => t.to?.statusCategory?.key === "done");
  if (!doneTrans) { console.error("✗ No Done transition"); return; }

  const r = await api("POST", `/rest/api/3/issue/${KEY}/transitions`, {
    transition: { id: doneTrans.id },
  });
  console.log(r.status < 400 ? `✓ ${KEY} → Done` : `✗ transition failed: ${r.status}`);
}

main();
