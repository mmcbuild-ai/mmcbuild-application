#!/usr/bin/env node
/**
 * Close SCRUM-156 (Comply Word export) and SCRUM-157 (Quote Word export):
 *  - Post a comment with the commit reference
 *  - Transition to Done
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
const AUTH = Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN || process.env.JIRA_API_KEY}`).toString("base64");

function adfDoc(text) {
  return {
    type: "doc", version: 1,
    content: text.split("\n\n").map((p) => ({ type: "paragraph", content: [{ type: "text", text: p }] })),
  };
}

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

const TICKETS = {
  "SCRUM-156": {
    module: "Comply",
    body: `Implemented and shipped in commit 01d2e70 on main (pushed 30 Apr 2026).

What changed:
- New file src/lib/comply/report-docx.ts — Word generator using the docx package already in package.json (no new dependency)
- src/app/api/comply/report/[checkId]/route.ts now accepts ?format=docx; default behaviour unchanged (PDF still served on bare GET)
- src/components/comply/export-button.tsx now renders two buttons: "Export PDF" + "Export Word"
- Output filename: mmc-comply-{slug}-v{n}.docx with the same project slug + report version logic as the PDF path

Word output mirrors the PDF: title block, overall risk, summary, category-summary table, optional workflow summary, findings tables grouped by category (with severity colour coding), NCC citations table, disclaimer. Editable in Word so builders can tailor before sending to clients.

Karen — once Vercel auto-deploys this, please retest TC-COMPLY-005 (SCRUM-131) and confirm the Word export opens correctly and contains all the same content as the PDF.`,
  },
  "SCRUM-157": {
    module: "Quote",
    body: `Implemented and shipped in commit 01d2e70 on main (pushed 30 Apr 2026).

What changed:
- New file src/lib/quote/report-docx.ts — Word generator using the docx package already in package.json
- src/app/api/quote/report/[estimateId]/route.ts now accepts ?format=docx; default behaviour unchanged
- src/components/shared/report-export-button.tsx (used by the Quote report) now renders two buttons: "Export PDF" + "Export Word"
- Output filename: mmc-quote-{slug}-v{n}.docx

Word output mirrors the PDF: title block + region, cost summary table (Traditional vs MMC vs Difference, plus duration row when available), summary paragraph, line items grouped by category with all columns (element, qty, traditional, MMC, saving %, source, confidence), data sources rollup, disclaimer. Saving % cells colour-coded green/red.

Karen — once Vercel auto-deploys, please retest TC-QUOTE-002 (SCRUM-137) and confirm the Word export opens correctly and matches the PDF content.`,
  },
};

const main = async () => {
  for (const [key, info] of Object.entries(TICKETS)) {
    console.log(`\n── ${key} (${info.module}) ──`);

    // 1. Post the closing comment
    const cmt = await api("POST", `/rest/api/3/issue/${key}/comment`, { body: adfDoc(info.body) });
    if (cmt.status >= 400) {
      console.log(`  ✗ Comment failed: ${cmt.status} ${JSON.stringify(cmt.body).slice(0, 200)}`);
      continue;
    }
    console.log(`  ✓ Comment posted`);

    // 2. Find the Done transition
    const trans = await api("GET", `/rest/api/3/issue/${key}/transitions`);
    const targets = trans.body?.transitions || [];
    const done =
      targets.find((t) => /^done$/i.test(t.name)) ||
      targets.find((t) => /complete|resolved|closed/i.test(t.name));
    if (!done) {
      console.log(`  ✗ No Done transition available. Options: ${targets.map(t => t.name).join(", ")}`);
      continue;
    }

    // 3. Apply the transition
    const tr = await api("POST", `/rest/api/3/issue/${key}/transitions`, { transition: { id: done.id } });
    if (tr.status >= 400) {
      console.log(`  ✗ Transition failed: ${tr.status} ${JSON.stringify(tr.body).slice(0, 200)}`);
      continue;
    }
    console.log(`  ✓ Moved to "${done.name}"`);
  }
};
main().catch(e => { console.error(e); process.exit(1); });
