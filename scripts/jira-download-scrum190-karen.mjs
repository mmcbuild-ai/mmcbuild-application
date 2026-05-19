#!/usr/bin/env node
/**
 * Download Karen's edited mmcbuild_question_inventory_v1.xlsx from SCRUM-190
 * (attachment 10042) and parse the "Re-ordering Workspace" sheet to show her
 * Keep/Move/Remove/New verdicts.
 *
 * Read-only on Jira side. Writes the .xlsx + extracted summary to scripts/.
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

const ATTACHMENT_ID = "10042";
const OUT_XLSX = "scripts/.scrum-190-karen.xlsx";
const OUT_ZIP = "scripts/.scrum-190-karen.zip";
const EXTRACT_DIR = "scripts/.scrum-190-xlsx-extract";

function fetch(hostname, path, headers, depth = 0) {
  return new Promise((resolve, reject) => {
    if (depth > 5) return reject(new Error("too many redirects"));
    const req = https.request(
      { hostname, path, method: "GET", headers },
      (res) => {
        console.log(`  [${depth}] ${res.statusCode}  ${hostname}${path.slice(0, 80)}`);
        if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
          const loc = res.headers.location;
          res.resume();
          if (!loc) return reject(new Error(`redirect with no location, status ${res.statusCode}`));
          const u = new URL(loc, `https://${hostname}${path}`);
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

function parseSharedStrings(xml) {
  const strings = [];
  const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = siRegex.exec(xml))) {
    const inner = m[1];
    // Concatenate all <t> runs inside this <si> (rich text has multiple <r><t>...</t></r>)
    const tRegex = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
    let s = "";
    let tm;
    while ((tm = tRegex.exec(inner))) s += tm[1];
    s = s
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
    strings.push(s);
  }
  return strings;
}

function colLetterToIndex(letters) {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function parseSheet(xml, sharedStrings) {
  const rows = [];
  const rowRegex = /<row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
  let rm;
  while ((rm = rowRegex.exec(xml))) {
    const rowNum = parseInt(rm[1], 10);
    const inner = rm[2];
    const cells = [];
    const cellRegex = /<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^/]*)\/>/g;
    let cm;
    while ((cm = cellRegex.exec(inner))) {
      const attrs = cm[1] ?? cm[3] ?? "";
      const body = cm[2] ?? "";
      const refMatch = /\br="([A-Z]+)(\d+)"/.exec(attrs);
      if (!refMatch) continue;
      const col = colLetterToIndex(refMatch[1]);
      const typeMatch = /\bt="([^"]+)"/.exec(attrs);
      const type = typeMatch?.[1] ?? "n";
      let value = "";
      if (type === "s") {
        const vMatch = /<v>([\s\S]*?)<\/v>/.exec(body);
        if (vMatch) value = sharedStrings[parseInt(vMatch[1], 10)] ?? "";
      } else if (type === "inlineStr") {
        const tMatch = /<t[^>]*>([\s\S]*?)<\/t>/.exec(body);
        if (tMatch) value = tMatch[1];
      } else {
        const vMatch = /<v>([\s\S]*?)<\/v>/.exec(body);
        if (vMatch) value = vMatch[1];
      }
      cells[col] = value;
    }
    rows[rowNum - 1] = cells;
  }
  return rows;
}

async function main() {
  console.log(`Downloading SCRUM-190 attachment ${ATTACHMENT_ID} (Karen's edited xlsx)…`);
  const buf = await fetch(HOST, `/rest/api/3/attachment/content/${ATTACHMENT_ID}`, {
    Authorization: `Basic ${AUTH}`,
    Accept: "*/*",
  });
  writeFileSync(OUT_XLSX, buf);
  console.log(`  → wrote ${OUT_XLSX} (${buf.length} bytes)`);

  if (buf[0] !== 0x50 || buf[1] !== 0x4b) {
    console.error(`ERROR: not a zip — first bytes: ${buf.slice(0, 16).toString("hex")}`);
    process.exit(1);
  }

  copyFileSync(OUT_XLSX, OUT_ZIP);
  execSync(
    `powershell -NoProfile -Command "Remove-Item -Recurse -Force '${EXTRACT_DIR}' -ErrorAction SilentlyContinue; Expand-Archive -Path '${OUT_ZIP}' -DestinationPath '${EXTRACT_DIR}'"`,
    { stdio: "pipe" },
  );

  // Load workbook.xml to map sheet names -> sheet1.xml etc
  const workbookXml = readFileSync(`${EXTRACT_DIR}/xl/workbook.xml`, "utf8");
  const sheets = [];
  const sheetRegex = /<sheet\b([^>]+?)\/>/g;
  let sm;
  while ((sm = sheetRegex.exec(workbookXml))) {
    const attrs = sm[1];
    const name = /name="([^"]+)"/.exec(attrs)?.[1] ?? "";
    const rid = /r:id="([^"]+)"/.exec(attrs)?.[1] ?? "";
    sheets.push({ name, rid });
  }
  const relsXml = readFileSync(`${EXTRACT_DIR}/xl/_rels/workbook.xml.rels`, "utf8");
  const ridToTarget = {};
  const relRegex = /<Relationship\b([^>]+?)\/>/g;
  let rm2;
  while ((rm2 = relRegex.exec(relsXml))) {
    const a = rm2[1];
    const id = /Id="([^"]+)"/.exec(a)?.[1];
    const t = /Target="([^"]+)"/.exec(a)?.[1];
    if (id && t) ridToTarget[id] = t;
  }
  console.log("\nSheets in workbook:");
  sheets.forEach((s) => console.log(`  - ${s.name}  (target: ${ridToTarget[s.rid]})`));

  const sharedXml = readFileSync(`${EXTRACT_DIR}/xl/sharedStrings.xml`, "utf8");
  const sharedStrings = parseSharedStrings(sharedXml);
  console.log(`  Shared strings: ${sharedStrings.length}`);

  // Find the working sheet (likely "Re-ordering Workspace")
  const targetSheet =
    sheets.find((s) => /re-?order|workspace/i.test(s.name)) ?? sheets[0];
  console.log(`\nParsing sheet: ${targetSheet.name}`);
  const sheetPath = ridToTarget[targetSheet.rid];
  const sheetXml = readFileSync(`${EXTRACT_DIR}/xl/${sheetPath}`, "utf8");
  const rows = parseSheet(sheetXml, sharedStrings);
  console.log(`  Rows parsed: ${rows.length}`);

  // Print all rows as TSV so we can see the headers and what Karen filled
  const out = rows
    .map((r, i) =>
      r
        ? `${(i + 1).toString().padStart(3, " ")} | ${r.map((c) => (c ?? "").toString().replace(/\n/g, " ⏎ ")).join(" | ")}`
        : `${(i + 1).toString().padStart(3, " ")} | (empty)`,
    )
    .join("\n");

  const outPath = "scripts/.scrum-190-karen-extracted.txt";
  writeFileSync(outPath, out);
  console.log(`  → wrote ${outPath} (${out.length} chars)`);

  // Tally verdicts: find the verdict column from header row
  const headerRow = rows.find((r) => r && r.some((c) => /verdict/i.test(c ?? "")));
  if (headerRow) {
    const verdictCol = headerRow.findIndex((c) => /verdict/i.test(c ?? ""));
    const moduleCol = headerRow.findIndex((c) => /^\s*module\s*$/i.test(c ?? ""));
    const sectionCol = headerRow.findIndex((c) => /^\s*section\s*$/i.test(c ?? ""));
    const labelCol = headerRow.findIndex((c) =>
      /^(label|question|prompt|text)$/i.test(c ?? ""),
    );
    const newModuleCol = headerRow.findIndex((c) =>
      /suggested.*module/i.test(c ?? ""),
    );
    const notesCol = headerRow.findIndex((c) => /notes/i.test(c ?? ""));
    console.log(
      `\nColumn indexes — module=${moduleCol}, section=${sectionCol}, label=${labelCol}, verdict=${verdictCol}, newModule=${newModuleCol}, notes=${notesCol}`,
    );
    const tally = {};
    const verdictRows = [];
    for (const r of rows) {
      if (!r) continue;
      const v = (r[verdictCol] ?? "").toString().trim();
      if (!v || /verdict/i.test(v)) continue;
      tally[v] = (tally[v] ?? 0) + 1;
      verdictRows.push({
        module: r[moduleCol] ?? "",
        section: r[sectionCol] ?? "",
        label: r[labelCol] ?? "",
        verdict: v,
        newModule: r[newModuleCol] ?? "",
        notes: r[notesCol] ?? "",
      });
    }
    console.log("\nVerdict tally:");
    for (const [v, n] of Object.entries(tally)) console.log(`  ${v}: ${n}`);

    console.log("\nVerdict rows (non-empty):");
    for (const vr of verdictRows) {
      const target = vr.newModule ? ` → ${vr.newModule}` : "";
      const notes = vr.notes ? `   [${vr.notes}]` : "";
      console.log(
        `  [${vr.verdict.padEnd(6)}] ${vr.module} / ${vr.section} :: ${vr.label}${target}${notes}`,
      );
    }
  } else {
    console.log("No 'verdict' header column found — inspect the raw .txt output.");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
