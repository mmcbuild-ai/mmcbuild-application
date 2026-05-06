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

function adfDoc(text) {
  const paragraphs = text.split("\n\n").map((p) => ({
    type: "paragraph",
    content: [{ type: "text", text: p }],
  }));
  return { type: "doc", version: 1, content: paragraphs };
}

function postComment(key, text) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ body: adfDoc(text) });
    const req = https.request({
      hostname: HOST,
      path: `/rest/api/3/issue/${key}/comment`,
      method: "POST",
      headers: {
        Authorization: `Basic ${AUTH}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    }, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        if (res.statusCode >= 400) {
          console.error(`  X ${key} - ${res.statusCode}: ${raw.slice(0, 200)}`);
          return resolve(false);
        }
        console.log(`  OK ${key} - comment posted`);
        resolve(true);
      });
    });
    req.on("error", (e) => { console.error(`  X ${key} - ${e.message}`); resolve(false); });
    req.setTimeout(20000, () => { req.destroy(); console.error(`  X ${key} - timeout`); resolve(false); });
    req.write(body);
    req.end();
  });
}

const comments = {
  "SCRUM-191": `Thanks Karen — confirmed and fixed.

Root cause: the floating chat widget is fixed at the bottom-right of the viewport (24px offset, 56px circle). The dashboard main area only had 24px bottom padding, so on long forms (Overview / Documents / Questionnaire) the Next and Save & Activate buttons sat in the same vertical zone as the chat circle when scrolled all the way down.

Fix: increased the dashboard main bottom padding to 96px (pb-24) so any bottom-of-page button now clears the chat widget on every dashboard page, not just Projects.

Change is in src/components/dashboard/dashboard-shell.tsx. Will land on the next preview deploy — please re-test on Overview / Documents / Questionnaire and confirm the buttons are no longer obscured. Closing once you confirm.`,

  "SCRUM-48": `Karen — to your Revit/SketchUp MCP question (best-guess action below):

Recommendation: don't block this ticket on the MCP question. Split it.

(1) Keep SCRUM-48 narrowly scoped to file-upload acceptance — accept .skp, .rvt, .dwg, .doc/.docx as additional plan upload formats alongside PDF. Today the extractor only reads PDFs; for SKP/RVT we treat the upload as an attached source-of-truth file and continue to require a PDF export for AI extraction. This is a few hours of work and unblocks designers who work natively in those tools.

(2) Raise a separate spike (I'll create SCRUM-XXX "MCP-driven model integration spike" if you agree) to evaluate the SketchUp MCP (now official Trimble) and the community Revit MCP for: (a) routing MMC Build design suggestions back into the model, (b) reading geometry directly into MMC Comply instead of PDF extraction, (c) native takeoffs for MMC Quote. This is a 2-3 day evaluation, not a build — output is a go/no-go memo plus a thin proof-of-concept against one module.

Why split: format acceptance is uncontroversial and ships now. The MCP path is a strategic pivot that affects the PRD's Design Optimisation module and our 3D viewer roadmap (PlanComparison3D already exists per the project notes) — it deserves its own decision with evidence, not a side-quest under an upload-formats ticket.

If you agree: I'll close SCRUM-48 to scope (a) only, and open the spike. Otherwise let me know if you want to defer (a) and tackle the MCP evaluation first.`,
};

console.log(`Posting ${Object.keys(comments).length} comments to ${HOST}\n`);
let ok = 0;
for (const [key, text] of Object.entries(comments)) {
  if (await postComment(key, text)) ok++;
}
console.log(`\n${ok}/${Object.keys(comments).length} comments posted.`);
