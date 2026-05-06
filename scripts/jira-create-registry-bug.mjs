#!/usr/bin/env node
/**
 * Create a SCRUM bug ticket for the AI model registry per-1k vs per-1M pricing bug.
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import https from "https";

const envPath = join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  readFileSync(envPath, "utf8").split("\n").forEach((line) => {
    const [key, ...rest] = line.split("=");
    if (key && rest.length && !process.env[key.trim()])
      process.env[key.trim()] = rest.join("=").trim();
  });
}

const HOST = process.env.JIRA_HOST || "corporateaisolutions-team.atlassian.net";
const PROJECT_KEY = process.env.JIRA_PROJECT || "SCRUM";
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
      hostname: HOST,
      path,
      method,
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
        if (res.statusCode >= 400) {
          console.error(`  ✗ ${method} ${res.statusCode}: ${raw.slice(0, 400)}`);
          return resolve(null);
        }
        try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve(null); }
      });
    });
    req.on("error", (e) => { console.error(`  ✗ ${e.message}`); resolve(null); });
    req.setTimeout(20000, () => { req.destroy(); resolve(null); });
    if (data) req.write(data);
    req.end();
  });
}

const SUMMARY = "AI model registry — per-1k vs per-1M pricing unit bug inflates logged costs 1000×";
const DESCRIPTION = `Found during pricing-options paper preparation (20 Apr 2026, see docs/pricing-options-v1.md).

Problem
-------
src/lib/ai/models/registry.ts defines fields named costPer1kInput and costPer1kOutput, but the values stored are actually per-million-token pricing (e.g. Claude Sonnet 4 stored as 3 for input — which is its per-1M rate, not its per-1k rate).

The estimateCost() function in router.ts computes:
  (inputTokens / 1000) * model.costPer1kInput

With the per-1M value of 3 and 1,000 input tokens, this yields $3 — which would be the cost of 1,000,000 tokens, not 1,000. Every value written to ai_usage_log.estimated_cost_usd is therefore overstated by 1000×.

Impact
------
- /settings/ai-performance dashboard shows costs inflated 1000×.
- Any pricing decisions made against that dashboard will be wildly wrong.
- If anyone has sent cost reports to Karen or Karthik based on these numbers, they need to be corrected.

Scope
-----
Two possible fixes — pick one and apply consistently:

Option A: Rename field to costPer1MInput / costPer1MOutput, and update estimateCost() to divide by 1,000,000:
  (inputTokens / 1000000) * model.costPer1MInput

Option B: Keep the field names (per-1k) and correct the values in registry.ts to actual per-1k prices:
  claude-sonnet-4: costPer1kInput: 0.003, costPer1kOutput: 0.015
  claude-haiku-4.5: costPer1kInput: 0.001, costPer1kOutput: 0.005
  gpt-4o: costPer1kInput: 0.0025, costPer1kOutput: 0.010
  gpt-4o-mini: costPer1kInput: 0.00015, costPer1kOutput: 0.0006
  text-embedding-3-small: costPer1kInput: 0.00002

Option A is the more idiomatic form (most model providers publish per-1M pricing today). Option B is a smaller diff.

Acceptance
----------
- Fix chosen, applied consistently
- Existing ai_usage_log rows do NOT need backfilling (cost was never billed from them; it's an internal metric). Optional: add a comment to the dashboard noting the fix date and that pre-fix rows are inflated.
- No test coverage gap introduced (add a tiny unit test for estimateCost).

Priority: HIGH (blocks trust in the pricing / billing analytics).`;

async function main() {
  const body = {
    fields: {
      project: { key: PROJECT_KEY },
      summary: SUMMARY,
      description: adfDoc(DESCRIPTION),
      issuetype: { name: "Story" },
      labels: ["bug", "billing", "ai"],
      priority: { name: "High" },
    },
  };

  console.log(`Creating ticket in ${PROJECT_KEY}...`);
  const result = await api("POST", "/rest/api/3/issue", body);
  if (result?.key) {
    console.log(`✓ Created ${result.key}: ${SUMMARY}`);
    console.log(`  https://${HOST}/browse/${result.key}`);
  } else {
    console.error("✗ Failed to create ticket");
  }
}

main();
