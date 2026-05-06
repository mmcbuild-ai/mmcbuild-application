#!/usr/bin/env node
/**
 * Render docs/meeting-agenda-30apr2026.md as a Word document.
 * Outputs docs/meeting-agenda-30apr2026.docx
 */
import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, AlignmentType, ShadingType,
} from "docx";

const HEADER_SHADING = { type: ShadingType.SOLID, color: "1E1E1E", fill: "1E1E1E" };

// Render a single line of inline markdown (bold, italic, code) into TextRuns.
function inline(text) {
  const runs = [];
  // Tokenise on **bold**, *italic*, `code`
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) runs.push(new TextRun({ text: text.slice(last, m.index), size: 22 }));
    const tok = m[0];
    if (tok.startsWith("**")) runs.push(new TextRun({ text: tok.slice(2, -2), bold: true, size: 22 }));
    else if (tok.startsWith("`")) runs.push(new TextRun({ text: tok.slice(1, -1), font: "Consolas", size: 20 }));
    else runs.push(new TextRun({ text: tok.slice(1, -1), italics: true, size: 22 }));
    last = m.index + tok.length;
  }
  if (last < text.length) runs.push(new TextRun({ text: text.slice(last), size: 22 }));
  return runs;
}

function headerCell(text, width) {
  return new TableCell({
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    shading: HEADER_SHADING,
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 20 })] })],
  });
}

function bodyCell(text) {
  return new TableCell({
    children: text.split("\n").map((line) => new Paragraph({ children: inline(line) })),
  });
}

// Markdown content for the agenda — kept here so we don't depend on a markdown parser.
// If the .md changes, mirror the changes here. The two are intentionally kept in sync by hand
// so we can tune the Word formatting without dragging in another library.
const AGENDA = {
  title: "Sprint 5 Standup — 30 Apr 2026",
  intro:
    "I have assessed every SCRUM task — what should have been done, by whom, what has been done, and what is outstanding. Tonight we run through only the items that need addressing.",
  sections: [
    {
      heading: "Status: Karen's feedback already actioned",
      lead:
        "Every distinct request Karen made in her test-case comments today has been (a) accounted for in Jira and (b) recoded where realistic before this meeting:",
      table: {
        headers: ["Karen's request", "Now tracked as", "Status"],
        widths: [40, 18, 42],
        rows: [
          ["Word export for compliance reports", "**SCRUM-156**", "**SHIPPED** — \"Export Word\" button now sits next to \"Export PDF\" on the Comply report page (commit 01d2e70)"],
          ["Word export for quote reports", "**SCRUM-157**", "**SHIPPED** — same button on the Quote report page (commit 01d2e70)"],
          ["Comply: accept DWG / SKT / RVT / DOCX upload formats", "**SCRUM-153**", "Logged. DOCX feasible (mammoth lib); DWG/SKT/RVT need a third-party CAD service — decision needed before build"],
          ["Comply: warn user when uploaded docs are insufficient", "**SCRUM-154**", "Logged. UX flow change — needs your call on which docs are \"essential\""],
          ["Comply: pre-validate at project-question level to reduce fails", "**SCRUM-155**", "Logged. Needs an audit of recent fail-types to decide which questions to add"],
          ["Quote: SIP wall data wrong, fence MMC appearing unexpectedly", "**SCRUM-158**", "Logged as **HIGH**-priority bug. Needs DB introspection + agent prompt audit — couldn't safely fix in time"],
          ["TC-BUILD-003 — Karen can't reach empty state", "**SCRUM-159**", "Logged. Workaround options listed — pick tonight"],
          ["TC-COMPLY-003 — verify trial run counter", "**SCRUM-160**", "Logged. Will check her Supabase row after the meeting and post evidence"],
        ],
      },
    },
    {
      heading: "Coverage of this assessment",
      table: {
        headers: ["Bucket", "Count", "Notes"],
        widths: [25, 10, 65],
        rows: [
          ["Sprint 4 tickets", "14", "All closed — nothing carried over, nothing dropped"],
          ["Sprint 5 tickets", "13", "5 Karen, 1 Karthik, 1 me, 6 unassigned"],
          ["Test-case tickets reviewed (TC-* in SCRUM-124..152)", "29", "Karen has tested Comply, Build, Quote — Direct, Train, Bill, Access not yet started"],
        ],
      },
      footer: "**Total reviewed: 56 tickets.**",
    },
    {
      heading: "A. Tests Karen could not run — need workarounds",
      table: {
        headers: ["Test", "Blocker", "Workaround to agree tonight"],
        widths: [22, 28, 50],
        rows: [
          ["**SCRUM-134 / TC-BUILD-003** — \"No project exists → redirected to project creation\"", "Karen already has saved projects under her login, can't reach the empty state", "**Option 1:** spin Karen a second login with zero projects.\n**Option 2:** I add a \"delete all my projects\" admin action she runs before each retest.\n**Option 3:** I run this test on a clean account and post evidence to the ticket.\n*Recommend Option 1 — fastest, doesn't change product code.*"],
          ["**SCRUM-128 / TC-COMPLY-002** — \"Upload invalid file type → error shown\"", "The file picker only shows PDFs, so she can't even select an invalid file", "**Rewrite the test** — real behaviour is \"picker only allows PDF\". Either reword the test case to match the guard, OR add a drag-and-drop test for non-PDF rejection. Decide tonight."],
          ["**SCRUM-129 / TC-COMPLY-003** — \"Run limit enforcement at 10 runs (Trial)\"", "Karen's trial ended but she doesn't know if the 10-run counter was initialised", "I check her account in Supabase tonight, post run count + tier history into the ticket as evidence. No product change if counter was correct."],
          ["**SCRUM-132 + SCRUM-133 / TC-BUILD-001 + TC-BUILD-002**", "Karen marked both \"needs re-test after Build module redesign\"", "Pre-condition: SCRUM-75 (Karen's Figma for Direct/Train) lands first, then I re-implement Build to match, then Karen re-tests. Confirm sequencing tonight."],
        ],
      },
    },
    {
      heading: "B. Real product issues found",
      table: {
        headers: ["Ticket", "Issue", "Status / Owner"],
        widths: [22, 38, 40],
        rows: [
          ["**SCRUM-158** (from SCRUM-138 / TC-QUOTE-003)", "Karen: \"If SIP was selected, then the data for Wall is not correct and why fence MMC was included\" — quote contents look wrong", "**HIGH-priority bug logged.** Needs Supabase introspection of cost_reference_rates for SIP rows + quote-agent prompt audit. Did not attempt a speculative fix — would risk making data integrity worse. Me — confirm ETA tonight."],
          ["**SCRUM-153 / 154 / 155** (from SCRUM-127 / TC-COMPLY-001)", "(a) Karen wants DWG / SKT / RVT / Word upload; (b) no warning when insufficient docs uploaded; (c) \"too many fails that could be resolved at the project question level\"", "All three split into separate tickets. Decisions needed: (a) DOCX is feasible now via mammoth — DWG/SKT/RVT need a CAD-conversion vendor decision; (b) need to define \"essential\" doc set; (c) need an audit of recent fail-types to pick which questions to add."],
          ["**Word export** (SCRUM-156 + SCRUM-157)", "Karen requested 3 times across Comply 131, Quote 137, Comply 127", "**SHIPPED in commit 01d2e70** — \"Export Word\" button now sits next to \"Export PDF\" on both Comply and Quote report pages. Pending push + Vercel deploy. No decision needed tonight."],
        ],
      },
    },
    {
      heading: "C. Sprint 5 structural gaps",
      list: [
        "**6 Sprint 5 tickets are unassigned** (SCRUM-115, 116, 118, 119, 120, 122). All read as engineering — propose I take them. Confirm tonight.",
        "**Sprint goal says \"Karen and Karthik review and sign off all 29 test cases\"** — but Karthik has no test-review ticket in Sprint 5. SCRUM-83 was his S4 sign-off. Either raise SCRUM-123-equivalent for Karthik, or confirm SCRUM-83 still satisfies the goal.",
        "**Karen has tested 14 of 29 test cases so far** (Onboarding, Comply, Build, Quote). Direct, Train, Billing, Access — not yet started. Set a target for completion before sprint close (7 May).",
        "**SCRUM-78 \"Recruit 5 beta users per persona group\"** — persona layer was removed in v0.4.x. Rescope to flat 5–10 beta testers observed by behaviour.",
      ],
    },
    {
      heading: "D. Carry-forward dependencies",
      list: [
        "**SCRUM-42** (mine, Base44 → Vercel) → blocks **SCRUM-84** (Karthik DNS cutover)",
        "**SCRUM-75** (Karen Figma) → blocks Build retest (SCRUM-132, 133)",
        "**SCRUM-41** (Karen Quick-start guide) — In Review. Who is the reviewer? Can it close tonight?",
      ],
    },
    {
      heading: "What's healthy — no discussion needed",
      list: [
        "**Sprint 4: 14/14 done, zero leftovers.**",
        "Tests Karen has confirmed PASS: NCC citations (SCRUM-130), PDF compliance export (SCRUM-131), cross-module project sharing (SCRUM-135), quote generation (SCRUM-136), quote PDF export (SCRUM-137).",
        "Onboarding tests (SCRUM-124, 125) — already obsoleted post-persona removal, closed cleanly.",
      ],
    },
    {
      heading: "Decisions required by end of meeting",
      ordered: [
        "**Workaround for Karen's blocked tests** — pick from menu in Section A",
        "**SCRUM-158 (quote SIP / fence bug)** — confirm me as owner and agree an ETA",
        "**SCRUM-153 (file-format expansion)** — DOCX upload now (small lift via mammoth) vs full DWG/SKT/RVT pack later (needs CAD-conversion vendor)",
        "**SCRUM-154 (insufficient-docs warning)** — agree the \"essential\" doc set so I can wire the warning",
        "**Six unassigned Sprint 5 tickets** (SCRUM-115, 116, 118, 119, 120, 122) — assign to me or split",
        "**Karthik test-review ticket** — raise new or rely on SCRUM-83",
        "**SCRUM-78 rescope** — confirm new wording (persona layer is gone)",
        "**Test completion target by 7 May** — how many of the remaining 15 test cases must Karen run",
      ],
    },
  ],
};

function buildSectionChildren(section) {
  const out = [];
  out.push(new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text: section.heading, bold: true, size: 28 })],
  }));
  if (section.lead) {
    out.push(new Paragraph({ spacing: { after: 120 }, children: inline(section.lead) }));
  }
  if (section.table) {
    const { headers, rows, widths } = section.table;
    out.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: headers.map((h, i) => headerCell(h, widths?.[i])),
        }),
        ...rows.map((row) => new TableRow({ children: row.map((c) => bodyCell(c)) })),
      ],
    }));
    out.push(new Paragraph({ text: "", spacing: { after: 120 } }));
  }
  if (section.footer) {
    out.push(new Paragraph({ spacing: { after: 120 }, children: inline(section.footer) }));
  }
  if (section.list) {
    for (const item of section.list) {
      out.push(new Paragraph({
        bullet: { level: 0 },
        children: inline(item),
      }));
    }
    out.push(new Paragraph({ text: "" }));
  }
  if (section.ordered) {
    for (const item of section.ordered) {
      out.push(new Paragraph({
        numbering: { reference: "agenda-decisions", level: 0 },
        children: inline(item),
      }));
    }
  }
  return out;
}

const children = [];
children.push(new Paragraph({
  heading: HeadingLevel.TITLE,
  alignment: AlignmentType.LEFT,
  children: [new TextRun({ text: AGENDA.title, bold: true, size: 40 })],
}));
children.push(new Paragraph({
  spacing: { after: 240 },
  children: [new TextRun({ text: AGENDA.intro, italics: true, size: 22 })],
}));
for (const s of AGENDA.sections) {
  for (const c of buildSectionChildren(s)) children.push(c);
}

const doc = new Document({
  creator: "MMC Build",
  title: AGENDA.title,
  description: "Sprint 5 standup agenda — 30 Apr 2026",
  styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
  numbering: {
    config: [
      {
        reference: "agenda-decisions",
        levels: [
          {
            level: 0, format: "decimal", text: "%1.",
            alignment: AlignmentType.START,
            style: { paragraph: { indent: { left: 360, hanging: 260 } } },
          },
        ],
      },
    ],
  },
  sections: [{
    properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
    children,
  }],
});

const out = join(process.cwd(), "docs", "meeting-agenda-30apr2026.docx");
mkdirSync(dirname(out), { recursive: true });
const buffer = await Packer.toBuffer(doc);
writeFileSync(out, buffer);
console.log(`✓ Wrote ${out}  (${(buffer.length / 1024).toFixed(1)} KB)`);
