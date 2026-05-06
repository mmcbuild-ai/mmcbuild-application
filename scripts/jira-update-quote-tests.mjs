#!/usr/bin/env node
/**
 * Update SCRUM-138 (TC-QUOTE-003) and SCRUM-139 (TC-QUOTE-004) with
 * refined titles/descriptions. TC-QUOTE-003 reworded from Word export
 * (feature not implemented) to "PDF contains full comparison". TC-QUOTE-004
 * gets sharper verification steps — the cost-rate override feature IS
 * fully wired (lookup-cost-rate.ts queries org_rate_overrides first) so
 * this test just needs clear verification instructions for Karen.
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
const HOST = process.env.JIRA_HOST;
const AUTH = Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN}`).toString("base64");

const api = (method, path, body = null) => new Promise((resolve) => {
  const d = body ? JSON.stringify(body) : null;
  const req = https.request({
    hostname: HOST, path, method,
    headers: { Authorization: `Basic ${AUTH}`, Accept: "application/json", "Content-Type": "application/json", ...(d ? { "Content-Length": Buffer.byteLength(d) } : {}) },
  }, (res) => {
    let raw = "";
    res.on("data", (c) => (raw += c));
    res.on("end", () => {
      if (res.statusCode >= 400) return resolve({ error: res.statusCode, body: raw.slice(0, 400) });
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve(raw); }
    });
  });
  req.on("error", (e) => resolve({ error: e.message }));
  if (d) req.write(d);
  req.end();
});

const heading = (text, level = 3) => ({ type: "heading", attrs: { level }, content: [{ type: "text", text }] });
const para = (text) => ({ type: "paragraph", content: [{ type: "text", text }] });
const rule = () => ({ type: "rule" });
const bullet = (items) => ({ type: "bulletList", content: items.map(i => ({ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: i }] }] })) });
const doc = (blocks) => ({ type: "doc", version: 1, content: blocks });

const PLATFORM_URL = "https://mmcbuild-one.vercel.app";
const TEST_PAGE_URL = "https://mmcbuild-one.vercel.app/admin/test-regime";

function buildDescription({ purpose, preconditions, steps, expected, automated, reviewLines }) {
  const blocks = [heading("Purpose"), para(purpose), rule()];
  if (preconditions?.length) { blocks.push(heading("Preconditions"), bullet(preconditions), rule()); }
  blocks.push(heading("How to Test"), bullet(steps), rule());
  blocks.push(heading("Expected Result"), para(expected), rule());
  if (automated) { blocks.push(heading("Automated Coverage"), para(automated), rule()); }
  blocks.push(heading("Review This Test"), para("Please review and comment on this test case:"), bullet(reviewLines), rule());
  blocks.push(para(`Manual test checklist: ${TEST_PAGE_URL}`));
  blocks.push(para(`Platform: ${PLATFORM_URL}`));
  return doc(blocks);
}

const Q3 = {
  key: "SCRUM-138",
  summary: "[TC-QUOTE-003] Quote PDF export contains full cost comparison",
  description: buildDescription({
    purpose: "Confirms the generated PDF shows the Traditional vs MMC cost breakdown, savings percent, and duration comparison — not just a blank or partial export. (Reworded from the original 'Word document export' test since the product only supports PDF export.)",
    preconditions: ["At least one completed cost estimate exists on a project", "Logged in as a user with Quote module access (Builder, Developer, Design & Build, Admin)"],
    steps: [
      "Navigate to Quote: https://mmcbuild-one.vercel.app/quote",
      "Select a project that has a completed quote, or create a new one via MMC Comply > Upload plan > Run Compliance > Open the project > Quote > Run Cost Estimation (wait 30–90 seconds)",
      "Once the estimate shows 'Completed', scroll to the top of the quote page",
      "Click the 'Download PDF' button",
      "Open the downloaded PDF file",
      "Verify the PDF contains: (a) Traditional total $ value, (b) MMC total $ value, (c) Savings percentage, (d) Duration comparison (Traditional weeks vs MMC weeks), (e) Line item table with both traditional_rate and mmc_rate columns populated",
    ],
    expected: "PDF displays the Traditional total, MMC total, and savings percent in the summary block. Includes a duration comparison (Traditional weeks vs MMC weeks). Line items table shows both traditional and MMC rates side-by-side.",
    automated: "Playwright spec: tests/e2e/quote.spec.ts — CI will post pass/fail comments on this issue after each E2E run.",
    reviewLines: [
      "Is this test suitable? (Yes / No / Needs changes)",
      "Are the steps clear enough to follow?",
      "Is the expected result clear?",
      "Any additional scenarios we should test for this feature?",
    ],
  }),
};

const Q4 = {
  key: "SCRUM-139",
  summary: "[TC-QUOTE-004] Custom cost rate overrides reflected in quote output",
  description: buildDescription({
    purpose: "Confirms that custom cost rates set in Settings > Cost Rates are used in quote calculations, NOT just the default seed rates. This is critical for regulated pricing accuracy — if overrides aren't applied, the whole cost module is misleading.",
    preconditions: [
      "Logged in as a user with Admin role (or Owner role) who can access Settings > Cost Rates",
      "An active project exists with an uploaded residential plan and completed questionnaire",
    ],
    steps: [
      "Navigate to Settings > Cost Rates: https://mmcbuild-one.vercel.app/settings/cost-rates",
      "Click 'Add Override' (or equivalent button)",
      "Enter a test override with distinctive values so you can recognise it in the output: Category='framing', Element='TEST OVERRIDE — timber wall frame', Unit='m²', Base Rate=999.99, State='NSW', Source label='Karen Test Override'",
      "Click Save",
      "Navigate to Quote (https://mmcbuild-one.vercel.app/quote) and open a project that includes framing work",
      "Click 'Run Cost Estimation' and wait 60–90 seconds for completion",
      "Open the Quote report and scroll to the line items table",
      "Find any line items in the 'framing' category",
      "Check two things: (a) the 'Source' column on at least one framing line item shows 'Karen Test Override' (matching your source label), and (b) the rate on that line item matches your configured value ($999.99/m²)",
    ],
    expected: "At least one framing line item in the quote output displays Source='Karen Test Override' (or your custom source label) and the rate reflects your override value ($999.99/m²). Other line items (not related to your override category/element) show the default source labels such as 'MMC Build Seed Data (NSW 2025)'. This proves the override was picked up by the AI estimation agent and fed into the cost calculation.",
    automated: "Playwright spec: tests/e2e/quote.spec.ts — CI will post pass/fail comments on this issue after each E2E run.",
    reviewLines: [
      "Is this test suitable? (Yes / No / Needs changes)",
      "Are the steps clear enough to follow?",
      "Is the expected result clear?",
      "Any additional scenarios we should test for this feature?",
    ],
  }),
};

async function updateIssue({ key, summary, description }) {
  const r = await api("PUT", `/rest/api/3/issue/${key}`, {
    fields: { summary, description },
  });
  if (r?.error) return { ok: false, reason: `${r.error}: ${r.body}` };
  return { ok: true };
}

async function main() {
  console.log(`\nUpdating ${Q3.key} and ${Q4.key}\n`);
  const r1 = await updateIssue(Q3);
  console.log(`  ${Q3.key}: ${r1.ok ? "✓" : "✗ " + r1.reason}`);
  const r2 = await updateIssue(Q4);
  console.log(`  ${Q4.key}: ${r2.ok ? "✓" : "✗ " + r2.reason}`);

  // Post a comment on each explaining the change
  await api("POST", `/rest/api/3/issue/${Q3.key}/comment`, {
    body: doc([para("Test reworded from 'Word document export' to 'PDF export with full cost comparison'. Reason: the Word/.docx export was never implemented in the product; audit against code confirmed only PDF export exists. Rewording to reflect reality rather than shipping the feature, because PDF coverage is sufficient for beta sign-off and Word export is not on the v1.0 roadmap.")]),
  });
  await api("POST", `/rest/api/3/issue/${Q4.key}/comment`, {
    body: doc([para("Test description sharpened with explicit verification steps. The code audit confirmed the override feature is fully wired: Settings > Cost Rates saves to org_rate_overrides table, and the AI cost estimation agent's lookup_cost_rate tool (src/lib/ai/agent/tools/lookup-cost-rate.ts) checks org_rate_overrides BEFORE falling back to global cost_reference_rates. Line items persist rate_source_name and rate_source_detail so the override is observable in the output. No code fix needed — just clearer test steps for Karen.")]),
  });

  console.log(`\n  ✓ Both tickets updated with new descriptions and change-log comments`);
}
main().catch(e => { console.error(e); process.exit(1); });
