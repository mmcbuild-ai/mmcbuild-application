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

const SPRINT_NAME = "Sprint 6 — Migration prep"; // 25 chars
const GOAL = "Lock the migration plan, provision MMC-owned infra, prepare VC due-diligence pack so Sprint 7 can execute the cutover cleanly.";
const KEYS = ["SCRUM-201", "SCRUM-202", "SCRUM-203", "SCRUM-204", "SCRUM-205", "SCRUM-206"];

const created = await api("POST", `/rest/agile/1.0/sprint`, {
  name: SPRINT_NAME,
  originBoardId: 1,
  goal: GOAL,
});
if (!created.body?.id) {
  console.error(`ERROR: ${JSON.stringify(created.body)}`);
  process.exit(1);
}
console.log(`ok Sprint 6 created: id ${created.body.id} "${created.body.name}"`);

const moved = await api("POST", `/rest/agile/1.0/sprint/${created.body.id}/issue`, { issues: KEYS });
console.log(`Move: status ${moved.status} ${moved.status >= 200 && moved.status < 300 ? 'ok' : JSON.stringify(moved.body).slice(0,300)}`);
console.log(`Moved into Sprint 6: ${KEYS.join(", ")}`);
