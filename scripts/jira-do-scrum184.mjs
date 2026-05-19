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

const COMMENT = `Fixed.

Root cause: dropzone copy claimed "DWG files are converted to PDF for analysis automatically", but the ingestion pipeline (src/lib/inngest/functions/process-plan.ts:122) actually calls convertDwg(buffer, name, "dxf") — DXF, not PDF. DXF preserves layers, entities, and text annotations needed for the downstream extractor (src/lib/plans/dxf-extractor.ts) to do auto-fill across comply / build / quote. PDF would lose that information.

Fix: src/components/projects/plan-dropzone.tsx:183 — copy now reads "DWG files are converted to DXF automatically — layers and entities are preserved for analysis." Accurate and explains the why.

Verified: only place this incorrect copy appeared. All other references in process-plan.ts and dxf-extractor.ts already say DXF.

Type check clean. Shipped in a small standalone commit on main.`;

const c = await api("POST", `/rest/api/3/issue/SCRUM-184/comment`, { body: adfDoc(COMMENT) });
console.log(`Comment: status ${c.status}`);

const tr = await api("GET", `/rest/api/3/issue/SCRUM-184/transitions`);
const done = (tr.body?.transitions || []).find((t) => /^done$/i.test(t.name));
if (done) {
  const tx = await api("POST", `/rest/api/3/issue/SCRUM-184/transitions`, { transition: { id: done.id } });
  console.log(`Transition -> Done: status ${tx.status}`);
}
