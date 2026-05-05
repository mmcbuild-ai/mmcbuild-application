#!/usr/bin/env node
/**
 * Create the SCRUM ticket for Karen to review the cross-module question
 * inventory (Project / Comply / Build / Quote), attach both deliverables,
 * and assign to Karen with tomorrow's due date.
 *
 * Outputs created by scripts/build-question-inventory.py.
 */
import { readFileSync, existsSync } from "fs";
import { join, basename } from "path";
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
const PROJECT_KEY = process.env.JIRA_PROJECT || "SCRUM";
const EMAIL = process.env.JIRA_EMAIL;
const TOKEN = process.env.JIRA_TOKEN || process.env.JIRA_API_KEY;
const AUTH = Buffer.from(`${EMAIL}:${TOKEN}`).toString("base64");

const KAREN_ACCOUNT_ID = "712020:394dbedd-1ff0-48c1-ab5d-4f6a49136935";

const XLSX_PATH = join(process.cwd(), "briefs", "outputs", "mmcbuild_question_inventory_v1.xlsx");
const DOCX_PATH = join(process.cwd(), "briefs", "outputs", "mmcbuild_question_inventory_v1.docx");

const SUMMARY = "Cross-module question inventory — Karen review of placement (Project/Comply/Build/Quote)";

const DESCRIPTION = `Karen, this ticket is the working surface for the cross-module question placement review we discussed on the call (evening 4 May 2026).

What's attached:
- mmcbuild_question_inventory_v1.xlsx — the working surface (use this to mark moves)
- mmcbuild_question_inventory_v1.docx — readable companion for context

Headline counts (84 questions total, source commit pinned in both files):
- Project (pre-module onboarding):  61 questions across 12 sections — includes Create dialog, Status field, full 9-step questionnaire, and Project Team form
- Comply: 15 workflow inputs (feedback, finding amend/reject/share, contributor remediation response). The Comply intake questionnaire is the same as Project's — verified, captured once.
- Build: 1 (Construction Systems multi-select with 6 options)
- Quote: 7 (Project Region selector + Holding Cost Calculator inputs)

How to use the Excel:
1. Open the "Re-ordering Workspace" sheet
2. For each row, fill in the working columns:
   - "Karen's Verdict" → Keep / Move / Remove
   - "Suggested New Module" → if moving, write the target module
   - "Suggested New Section" → if moving, write the target section
   - "Notes" → reasoning, dependencies, anything Dennis should know
3. Conditional formatting will highlight: yellow if you suggest a different module, green if Verdict=Keep, red if Verdict=Remove
4. Save the file with your changes and reattach (or send back via email/Slack)

Pre-flagged candidates worth a look (full list in the Gaps section of both files):
- Step 0 "Project Status" questions (design_stage, project_goals, submission_timeline) overlap conceptually with the project record's status field. Two sources of truth.
- Build's Construction Systems is in Build, but flows downstream to Comply, Quote, Directory, Training. Likely a Project-intake question.
- Quote's Region selector duplicates what could be derived from the Project address.
- Wind classification, climate zone, and BAL are auto-derived from the address but still presented as overridable questions — Karen, do you want them as confirmable values or hidden auto-fields?
- Workflow inputs under Comply (feedback widgets, amend/reject dialogs, contributor response form) are operational forms, not intake — feel free to filter these out when reordering.

Dennis is the approval gate for the final placement decisions. Once you've marked the file, we'll discuss at the next session and I'll implement the moves.

Source: brief at C:\\Users\\denni\\Downloads\\CLAUDE_CODE_BRIEF_question_inventory.docx
Generated: ${new Date().toISOString().split("T")[0]}`;

function adfDoc(text) {
  return {
    type: "doc",
    version: 1,
    content: text.split("\n\n").map((p) => ({
      type: "paragraph",
      content: [{ type: "text", text: p }],
    })),
  };
}

function api(method, path, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        hostname: HOST,
        path,
        method,
        headers: {
          Authorization: `Basic ${AUTH}`,
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          let parsed = null;
          if (raw) {
            try {
              parsed = JSON.parse(raw);
            } catch {
              parsed = raw;
            }
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    req.on("error", (e) => resolve({ status: 0, body: { error: e.message } }));
    req.setTimeout(30000, () => {
      req.destroy();
      resolve({ status: 0, body: "timeout" });
    });
    if (data) req.write(data);
    req.end();
  });
}

function uploadAttachment(issueKey, filePath, mime) {
  return new Promise((resolve) => {
    if (!existsSync(filePath)) {
      console.error(`  ✗ file not found: ${filePath}`);
      return resolve(false);
    }
    const fileBuf = readFileSync(filePath);
    const filename = basename(filePath);
    const boundary = "----" + randomBytes(16).toString("hex");
    const header = Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
        `Content-Type: ${mime}\r\n\r\n`,
      "utf8"
    );
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");
    const body = Buffer.concat([header, fileBuf, footer]);

    const req = https.request(
      {
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
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          if (res.statusCode >= 400) {
            console.error(
              `  ✗ ${issueKey} ← ${filename}: ${res.statusCode} ${raw.slice(0, 200)}`
            );
            return resolve(false);
          }
          console.log(
            `  ✓ ${issueKey} ← ${filename} (${(fileBuf.length / 1024).toFixed(1)} KB)`
          );
          resolve(true);
        });
      }
    );
    req.on("error", (e) => {
      console.error(`  ✗ ${issueKey}: ${e.message}`);
      resolve(false);
    });
    req.setTimeout(90000, () => {
      req.destroy();
      resolve(false);
    });
    req.write(body);
    req.end();
  });
}

async function main() {
  if (!EMAIL || !TOKEN) {
    console.error("Missing JIRA_EMAIL or JIRA_TOKEN/JIRA_API_KEY in .env.local");
    process.exit(1);
  }
  if (!existsSync(XLSX_PATH) || !existsSync(DOCX_PATH)) {
    console.error("Inventory outputs not found. Run scripts/build-question-inventory.py first.");
    process.exit(1);
  }

  // Tomorrow (Sydney) — keep simple, ISO date YYYY-MM-DD
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const dueDate = tomorrow.toISOString().split("T")[0];

  console.log(`Creating ticket in ${PROJECT_KEY}...`);
  const create = await api("POST", "/rest/api/3/issue", {
    fields: {
      project: { key: PROJECT_KEY },
      summary: SUMMARY,
      description: adfDoc(DESCRIPTION),
      issuetype: { name: "Task" },
      labels: ["from-karen-feedback", "question-inventory", "review", "v0.4.0"],
      priority: { name: "High" },
      assignee: { accountId: KAREN_ACCOUNT_ID },
      duedate: dueDate,
    },
  });

  if (!create.body?.key) {
    console.error(`✗ Failed to create ticket: ${JSON.stringify(create.body).slice(0, 500)}`);
    process.exit(1);
  }

  const key = create.body.key;
  console.log(`✓ Created ${key} (assigned to Karen, due ${dueDate})\n`);

  console.log("Attaching deliverables...");
  await uploadAttachment(
    key,
    XLSX_PATH,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  await uploadAttachment(
    key,
    DOCX_PATH,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );

  console.log(`\nDone. Ticket: https://${HOST}/browse/${key}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
