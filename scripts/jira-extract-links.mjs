#!/usr/bin/env node
/**
 * Extract any hyperlinks (ADF link marks) from a ticket's description + comments.
 */
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

const KEYS = process.argv.slice(2);
if (!KEYS.length) { console.error("usage: node scripts/jira-extract-links.mjs SCRUM-75 SCRUM-60 ..."); process.exit(1); }

function api(path) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: HOST, path, method: "GET",
      headers: { Authorization: `Basic ${AUTH}`, Accept: "application/json" },
    }, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        if (res.statusCode >= 400) return resolve(null);
        try { resolve(JSON.parse(raw)); } catch { resolve(null); }
      });
    });
    req.on("error", () => resolve(null));
    req.setTimeout(20000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

// Walk ADF tree and pull out (a) text, (b) link-mark hrefs, (c) inlineCard/mediaSingle URLs
function walk(node, out) {
  if (!node) return;
  if (Array.isArray(node)) { node.forEach((n) => walk(n, out)); return; }
  if (node.type === "text" && node.text) {
    out.text.push(node.text);
    if (node.marks) {
      for (const mark of node.marks) {
        if (mark.type === "link" && mark.attrs?.href) {
          out.links.push({ text: node.text, href: mark.attrs.href });
        }
      }
    }
  }
  if (node.type === "inlineCard" && node.attrs?.url) {
    out.inlineCards.push(node.attrs.url);
  }
  if (node.type === "blockCard" && node.attrs?.url) {
    out.blockCards.push(node.attrs.url);
  }
  if (node.content) walk(node.content, out);
}

function extract(adf) {
  const out = { text: [], links: [], inlineCards: [], blockCards: [] };
  walk(adf, out);
  return out;
}

for (const key of KEYS) {
  const issue = await api(`/rest/api/3/issue/${key}?fields=summary,description,attachment`);
  if (!issue) { console.log(`✗ ${key} not found`); continue; }
  const f = issue.fields;

  console.log(`\n${"═".repeat(70)}`);
  console.log(`${key}: ${f.summary}`);
  console.log("─".repeat(70));

  const descExtract = extract(f.description);
  if (descExtract.links.length > 0) {
    console.log("Description links:");
    for (const l of descExtract.links) {
      console.log(`  [${l.text}] → ${l.href}`);
    }
  }
  if (descExtract.inlineCards.length > 0) {
    console.log("Description inlineCards:");
    for (const u of descExtract.inlineCards) console.log(`  ${u}`);
  }
  if (descExtract.blockCards.length > 0) {
    console.log("Description blockCards:");
    for (const u of descExtract.blockCards) console.log(`  ${u}`);
  }

  if (f.attachment?.length > 0) {
    console.log("Attachments:");
    for (const a of f.attachment) {
      console.log(`  ${a.filename} (${a.author?.displayName}, ${a.created})`);
      console.log(`    content URL: ${a.content}`);
    }
  }

  const comments = await api(`/rest/api/3/issue/${key}/comment`);
  if (comments?.comments?.length) {
    for (const c of comments.comments) {
      const cExtract = extract(c.body);
      if (cExtract.links.length > 0 || cExtract.inlineCards.length > 0 || cExtract.blockCards.length > 0) {
        console.log(`\nComment — ${c.author?.displayName} @ ${c.created}`);
        for (const l of cExtract.links) console.log(`  [${l.text}] → ${l.href}`);
        for (const u of cExtract.inlineCards) console.log(`  inlineCard: ${u}`);
        for (const u of cExtract.blockCards) console.log(`  blockCard: ${u}`);
      }
    }
  }
}
