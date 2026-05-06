#!/usr/bin/env node
/**
 * Attach the two PDF summaries to the relevant Jira tickets and post a
 * high-level outcome comment on each. Done tickets still accept attachments.
 *
 * Target attachments + comments:
 *   SCRUM-73   (Token tracking + pricing summary)  — attach BOTH PDFs
 *   SCRUM-121  (Registry per-1M pricing unit bug)  — attach pricing options PDF
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import https from "https";
import { randomBytes } from "crypto";

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

const TOKEN_PDF = "C:\\Users\\denni\\Downloads\\MMC_Build_Token_Usage_Summary_SCRUM73_20Apr2026.pdf";
const PRICING_PDF = "C:\\Users\\denni\\Downloads\\MMC_Build_Pricing_Options_v1_20Apr2026.pdf";

function adfDoc(text) {
  const paragraphs = text.split("\n\n").map((p) => ({
    type: "paragraph",
    content: [{ type: "text", text: p }],
  }));
  return { type: "doc", version: 1, content: paragraphs };
}

function apiJson(method, path, body) {
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
    req.setTimeout(60000, () => { req.destroy(); resolve({ status: 0, body: "timeout" }); });
    if (data) req.write(data);
    req.end();
  });
}

function uploadAttachment(issueKey, filePath, filename) {
  return new Promise((resolve) => {
    if (!existsSync(filePath)) {
      console.error(`  ✗ file not found: ${filePath}`);
      return resolve(false);
    }
    const fileBuf = readFileSync(filePath);
    const boundary = "----" + randomBytes(16).toString("hex");
    const header = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: application/pdf\r\n\r\n`,
      "utf8"
    );
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");
    const body = Buffer.concat([header, fileBuf, footer]);

    const req = https.request({
      hostname: HOST,
      path: `/rest/api/3/issue/${issueKey}/attachments`,
      method: "POST",
      headers: {
        Authorization: `Basic ${AUTH}`,
        Accept: "application/json",
        "X-Atlassian-Token": "no-check",
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": body.length,
      },
    }, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        if (res.statusCode >= 400) {
          console.error(`  ✗ ${issueKey} ← ${filename}: ${res.statusCode} ${raw.slice(0, 200)}`);
          return resolve(false);
        }
        console.log(`  ✓ ${issueKey} ← ${filename} (${(fileBuf.length / 1024).toFixed(1)} KB)`);
        resolve(true);
      });
    });
    req.on("error", (e) => { console.error(`  ✗ ${issueKey}: ${e.message}`); resolve(false); });
    req.setTimeout(90000, () => { req.destroy(); resolve(false); });
    req.write(body);
    req.end();
  });
}

// ── Comment bodies ───────────────────────────────────────────────────────
const SCRUM_73_COMMENT = `SUMMARY OF OUTCOMES (for Karen + Karthik, pre-call briefing)

Headline: 78% cost-per-run reduction shipped and empirically validated today. From $2.21 to $0.49 per full compliance run, measured in production. Empirical gross margins on current published pricing are now 98%+ (not the 77–79% we projected without caching).

What this means: we have four alternative pricing options in play, all of which remain profitable with substantial headroom. The status quo pricing is no longer an urgent commercial issue — it's already strongly profitable. The decision becomes one of customer experience and risk appetite rather than margin preservation.

The five options (detailed in the attached Pricing Options v1 PDF):
A. Status quo — flat $149/$399/custom subscription with fixed run caps. Margin 77–79% average, but asymmetric downside on large-plan outliers.
B. Pay-per-run metered — $15/run + $49 base. Always profitable but unpredictable customer bill.
C. Credit-based with plan-size weighting ★ RECOMMENDED. 1/2/4 credits per light/medium/heavy plan. Fairness, outlier protection, clear upsell path, already instrumented.
D. Hybrid subscription + overage — $149 base + $20 per extra run. Familiar but no outlier protection.
E. Per-project — $299 for 90 days unlimited runs on one project. Matches builder mental model but margin erosion risk at high re-run counts.

Recommendation: Option C (credit-based with plan-size weighting). Not because the status quo is broken — measured margins are now 98%+ — but because credit-based pricing protects margin against single-run outliers (e.g. a 300-page commercial plan), and gives a clear upsell path without adding infrastructure we don't already have. The v1 paper has full rationale, proposed tiers, open risks, and a 5-step next-actions plan.

Attachments: Token Usage Summary PDF (this ticket's validation data) + Pricing Options v1 PDF (full commercial analysis).`;

const SCRUM_121_COMMENT = `Context for this ticket (from the Pricing Options analysis):

This registry unit bug was discovered during preparation of the attached Pricing Options v1 paper. It inflated every logged cost by 1000× — which meant the /settings/ai-performance dashboard and any pricing decisions made against ai_usage_log.estimated_cost_usd were based on numbers three orders of magnitude too high.

Fix shipped 20 Apr (commit 235127f): renamed costPer1kInput/Output → costPer1MInput/Output on the registry interface and all 6 model entries; updated the estimateCost formula to divide by 1,000,000. Unit test added in tests/unit/ai-models/registry-pricing.test.ts to catch regression.

Impact on downstream work: the SCRUM-73 token tracking + pricing analysis could not have produced trustworthy numbers without this fix. Closing both tickets today with validated $0.49/run figure (see SCRUM-73 for the data).

Attachment: Pricing Options v1 PDF for the source-of-discovery reference.`;

// ── Main ─────────────────────────────────────────────────────────────────
console.log("Uploading attachments and posting summary comments...\n");

console.log("SCRUM-73 — Token Usage Summary + Pricing Options");
await uploadAttachment("SCRUM-73", TOKEN_PDF, "MMC_Build_Token_Usage_Summary_SCRUM73_20Apr2026.pdf");
await uploadAttachment("SCRUM-73", PRICING_PDF, "MMC_Build_Pricing_Options_v1_20Apr2026.pdf");
const c73 = await apiJson("POST", `/rest/api/3/issue/SCRUM-73/comment`, { body: adfDoc(SCRUM_73_COMMENT) });
console.log(c73.status < 400 ? "  ✓ summary comment posted" : `  ✗ comment ${c73.status}`);

console.log("\nSCRUM-121 — Pricing Options (source of discovery)");
await uploadAttachment("SCRUM-121", PRICING_PDF, "MMC_Build_Pricing_Options_v1_20Apr2026.pdf");
const c121 = await apiJson("POST", `/rest/api/3/issue/SCRUM-121/comment`, { body: adfDoc(SCRUM_121_COMMENT) });
console.log(c121.status < 400 ? "  ✓ context comment posted" : `  ✗ comment ${c121.status}`);

console.log("\nDone.");
