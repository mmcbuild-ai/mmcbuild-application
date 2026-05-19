#!/usr/bin/env node
/**
 * Create the Revit/SketchUp MCP integration spike ticket.
 * Output: go/no-go memo + thin PoC against ONE module (Build first).
 * Phasing in the brief: SketchUp first (vendor-backed, matches ICP), Revit second.
 */
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
const PROJECT_KEY = process.env.JIRA_PROJECT || "SCRUM";
const AUTH = Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN || process.env.JIRA_API_KEY}`).toString("base64");

function adfDoc(text) {
  return { type: "doc", version: 1, content: text.split("\n\n").map((p) => ({ type: "paragraph", content: [{ type: "text", text: p }] })) };
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
      res.on("end", () => { let parsed = null; if (raw) { try { parsed = JSON.parse(raw); } catch { parsed = raw; } } resolve({ status: res.statusCode, body: parsed }); });
    });
    req.on("error", (e) => resolve({ status: 0, body: { error: e.message } }));
    req.setTimeout(20000, () => { req.destroy(); resolve({ status: 0, body: "timeout" }); });
    if (data) req.write(data);
    req.end();
  });
}

const TICKET = {
  summary: "Spike: MCP-driven CAD model integration (SketchUp first, Revit second) - go/no-go memo + thin PoC",
  type: "Story",
  priority: "Medium",
  labels: ["spike", "mcp", "cad-integration", "build", "comply", "quote", "v0.5.0-candidate"],
  body: `Background
Karen flagged that Revit and SketchUp both now expose MCP servers. Trimble's SketchUp MCP is an official Connector in Claude's MCP directory; Revit MCP is community-driven and recently consolidated at github.com/mcp-servers-for-revit/mcp-servers-for-revit. Autodesk Fusion has also shipped two MCP servers. This materially changes the post-MVP "3D viewer + SKP download" line in the PRD: instead of a custom viewer, Claude could drive the user's actual CAD model and the AI suggestions become the model.

Architecture-relevant repo state today
- PlanComparison3D + plan-3d-reveal.tsx (react-three-fiber, shipped commit 237c38b, SCRUM-161/162)
- src/lib/build/spatial/ - PDF -> SpatialLayout extractor
- src/lib/inngest/functions/run-design-optimisation.ts - AI optimisation pipeline
- src/lib/security-gate.ts - prompt-injection guard (REGULATED tier, must still apply to model-derived prompts)
- Paywall enforced at middleware AND server-action layers per project CLAUDE.md

Spike scope (2-3 days)
Evaluate whether an AI-to-CAD pipeline via MCP is a viable replacement (or complement) to the current PDF-upload-and-render SaaS path for ICP users (architects/designers, pre-final-drawings).

Phase 1 - SketchUp first (priority)
Reason: Trimble-backed, in Claude's MCP connector directory, matches the ICP memory (SketchUp dominates the pre-final-drawings stage). Revit is more commercial / late-BIM and lower ICP fit.
- Stand up the SketchUp MCP locally; verify the surface area (geometry read, element write, materials, exports)
- Build a minimal MMC-Build MCP server (mcp-poc/ in this repo) that exposes ONE verb: optimise_current_model. It pulls geometry from SketchUp MCP, calls run-design-optimisation, and writes suggestions back as model annotations
- Validate the auth/billing/security boundary: how an MCP-driven call routes through our paywall + checkAndIncrementUsage + security-gate.ts without bypassing them

Phase 2 - Revit validation (lighter)
- Repeat the exercise against the consolidated Revit MCP
- Note breaking-change cadence and stability vs the Trimble-hosted SketchUp path
- Confirm whether the MCP-server abstraction generalises across both

Out of scope for this spike
- Building the production MCP server (only if go-decision)
- Deprecating PlanComparison3D / spatial extractor (those remain the non-CAD-user path)
- Comply or Quote integration in code (mentioned in the original SCRUM-48 brief but Build is the cleanest first PoC; Comply/Quote follow once architecture is proven)

Deliverables
1. docs/spike-revit-sketchup-mcp.md - go/no-go memo, owner-signed
2. mcp-poc/ - thin PoC code (SketchUp -> MMC Build -> SketchUp) good enough to demo to Karen
3. Architecture decision recorded in .context/DECISIONS.md
4. If go: v0.5.0 candidate epic with 3-5 implementation tickets
5. If no-go: documented reasons + revisit trigger

Acceptance criteria
- SketchUp PoC can: open a model, send geometry to the optimisation endpoint, receive suggestions, annotate the model
- Auth path documented: how the user's local Claude Desktop authenticates to our API for an MCP-driven call without a browser session
- Paywall path documented: MCP-driven runs hit checkAndIncrementUsage exactly the same as web-driven runs
- Security gate verified: model-derived geometry passing through security-gate.ts before any AI prompt construction
- Revit feasibility noted with one paragraph plus a confidence rating

Open questions for Karen
1. Should the Phase 1 PoC target Build (suggestions back into the model) or Comply (model -> NCC checks)? Recommend Build - closer to the existing 3D viewer work and easier to demo
2. Are we comfortable making the MCP path a paid-tier-only feature, or does a free-tier MCP path matter for funnel?
3. Does the PRD need an explicit "power user / desktop integration" surface alongside the SaaS, or is this an internal capability we do not yet productise?

References
- PRD section: 3D viewer + SKP download (post-MVP aspiration)
- SCRUM-48 - original upload-formats ticket where this came up
- Commit 237c38b - current 3D viewer state
- Memory: ICP is architects/designers, pre-final-drawings`,
};

const main = async () => {
  console.log(`Creating Revit/SketchUp MCP spike ticket in ${PROJECT_KEY}...\n`);
  const r = await api("POST", "/rest/api/3/issue", {
    fields: {
      project: { key: PROJECT_KEY },
      summary: TICKET.summary,
      description: adfDoc(TICKET.body),
      issuetype: { name: TICKET.type },
      labels: TICKET.labels,
      priority: { name: TICKET.priority },
    },
  });
  if (r.body?.key) {
    console.log(`OK ${r.body.key} created`);
    console.log(`   ${TICKET.summary}`);
  } else {
    console.log(`X FAILED`);
    console.log(`   ${JSON.stringify(r.body).slice(0, 400)}`);
    process.exit(1);
  }
};
main().catch((e) => { console.error(e); process.exit(1); });
