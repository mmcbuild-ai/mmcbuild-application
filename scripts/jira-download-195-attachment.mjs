#!/usr/bin/env node
/**
 * Download Karthik's POC - MVP Technical Migration.docx from SCRUM-195 and extract text.
 * Read-only on Jira side; writes the .docx + extracted .txt to scripts/.
 */
import { readFileSync, existsSync, writeFileSync, copyFileSync } from "fs";
import { join } from "path";
import https from "https";
import { execSync } from "child_process";

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
const AUTH = Buffer.from(
  `${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN || process.env.JIRA_API_KEY}`,
).toString("base64");

const ATTACHMENT_ID = "10045";
const OUT_DOCX = "scripts/.scrum-195-attachment.docx";
const OUT_ZIP = "scripts/.scrum-195-attachment.zip";

function fetch(hostname, path, headers, depth = 0) {
  return new Promise((resolve, reject) => {
    if (depth > 5) return reject(new Error("too many redirects"));
    const req = https.request(
      { hostname, path, method: "GET", headers },
      (res) => {
        console.log(`  [${depth}] ${res.statusCode}  ${hostname}${path.slice(0, 80)}`);
        if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
          const loc = res.headers.location;
          res.resume(); // discard body
          if (!loc) return reject(new Error(`redirect with no location, status ${res.statusCode}`));
          const u = new URL(loc, `https://${hostname}${path}`);
          // Don't forward Authorization to a different host (signed URLs already auth via query string)
          const newHeaders = u.hostname === hostname ? headers : { Accept: "*/*" };
          fetch(u.hostname, u.pathname + u.search, newHeaders, depth + 1).then(resolve, reject);
          return;
        }
        if (res.statusCode >= 400) {
          let err = "";
          res.on("data", (c) => (err += c));
          res.on("end", () => reject(new Error(`HTTP ${res.statusCode}: ${err.slice(0, 200)}`)));
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      },
    );
    req.on("error", reject);
    req.setTimeout(60000, () => { req.destroy(); reject(new Error("timeout")); });
    req.end();
  });
}

async function main() {
  console.log("Downloading attachment 10045 from SCRUM-195…");
  const buf = await fetch(HOST, `/rest/api/3/attachment/content/${ATTACHMENT_ID}`, {
    Authorization: `Basic ${AUTH}`,
    Accept: "*/*",
  });
  writeFileSync(OUT_DOCX, buf);
  console.log(`  → wrote ${OUT_DOCX} (${buf.length} bytes)`);

  if (buf.length === 0) {
    console.error("ERROR: empty download");
    process.exit(1);
  }

  // Sanity check: docx files start with PK (zip magic)
  if (buf[0] !== 0x50 || buf[1] !== 0x4b) {
    console.error(`ERROR: not a zip — first bytes: ${buf.slice(0, 16).toString("hex")}`);
    console.error(`First 200 chars: ${buf.toString("utf8", 0, 200)}`);
    process.exit(1);
  }

  // Copy to .zip so PowerShell's Expand-Archive will accept it
  copyFileSync(OUT_DOCX, OUT_ZIP);

  const tmp = "scripts/.scrum-195-docx-extract";
  execSync(
    `powershell -NoProfile -Command "Remove-Item -Recurse -Force '${tmp}' -ErrorAction SilentlyContinue; Expand-Archive -Path '${OUT_ZIP}' -DestinationPath '${tmp}'"`,
    { stdio: "pipe" },
  );

  const xml = readFileSync(`${tmp}/word/document.xml`, "utf8");

  // Convert document.xml to readable text
  const paragraphs = [];
  const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  let m;
  while ((m = pRegex.exec(xml))) {
    const inner = m[1];
    const styleMatch = /<w:pStyle w:val="([^"]+)"/.exec(inner);
    const style = styleMatch?.[1] || "";
    const textRuns = [];
    const tRegex = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
    let tm;
    while ((tm = tRegex.exec(inner))) textRuns.push(tm[1]);
    const hasBreak = /<w:br\b/.test(inner);
    let text = textRuns.join("");
    text = text
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
    if (!text.trim() && !hasBreak) continue;
    if (/^Heading1$/i.test(style)) text = "\n# " + text;
    else if (/^Heading2$/i.test(style)) text = "\n## " + text;
    else if (/^Heading3$/i.test(style)) text = "\n### " + text;
    else if (/^Heading4$/i.test(style)) text = "\n#### " + text;
    else if (/^Title$/i.test(style)) text = "\n# " + text;
    else if (/ListParagraph/i.test(style)) text = "  • " + text;
    paragraphs.push(text);
  }

  const out = paragraphs.join("\n");
  const outPath = "scripts/.scrum-195-extracted.txt";
  writeFileSync(outPath, out);
  console.log(`  → extracted text to ${outPath} (${out.length} chars)`);
  console.log(`\n${"=".repeat(80)}\n`);
  console.log(out);
}

main().catch((e) => { console.error(e); process.exit(1); });
