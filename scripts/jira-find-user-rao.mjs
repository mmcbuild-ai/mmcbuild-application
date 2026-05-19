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

function api(path) {
  return new Promise((resolve) => {
    https.request({ hostname: HOST, path, method: "GET",
      headers: { Authorization: `Basic ${AUTH}`, Accept: "application/json" } }, (res) => {
      let raw = ""; res.on("data", (c) => raw += c);
      res.on("end", () => { try { resolve(JSON.parse(raw)); } catch { resolve(raw); } });
    }).on("error", (e) => resolve({ error: e.message })).end();
  });
}

console.log("=== Search by query 'rao.kar' ===");
const users1 = await api(`/rest/api/3/user/search?query=${encodeURIComponent("rao.kar@gmail.com")}`);
console.log(JSON.stringify(users1, null, 2));

console.log("\n=== Search by query 'karthik' ===");
const users2 = await api(`/rest/api/3/user/search?query=karthik`);
console.log(JSON.stringify(users2, null, 2));

console.log("\n=== Search by query 'karthik.rao@mmcbuild' ===");
const users3 = await api(`/rest/api/3/user/search?query=${encodeURIComponent("karthik.rao@mmcbuild.com.au")}`);
console.log(JSON.stringify(users3, null, 2));
