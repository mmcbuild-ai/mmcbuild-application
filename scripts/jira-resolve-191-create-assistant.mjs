#!/usr/bin/env node
/**
 * 1. Update SCRUM-191 (icon-blocking-button) with what shipped and transition to Done.
 * 2. Create a new ticket for the "Need help?" assistant build, assign to Dennis,
 *    transition to Done.
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
const AUTH = Buffer.from(
  `${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN || process.env.JIRA_API_KEY}`,
).toString("base64");

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
          ...(data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          let parsed = null;
          if (raw) { try { parsed = JSON.parse(raw); } catch { parsed = raw; } }
          resolve({ status: res.statusCode, body: parsed });
        });
      },
    );
    req.on("error", (e) => resolve({ status: 0, body: { error: e.message } }));
    req.setTimeout(20000, () => { req.destroy(); resolve({ status: 0, body: "timeout" }); });
    if (data) req.write(data);
    req.end();
  });
}

async function transitionToDone(key) {
  const t = await api("GET", `/rest/api/3/issue/${key}/transitions`);
  if (t.status >= 400) return { ok: false, reason: `transitions fetch ${t.status}` };
  const targets = t.body?.transitions || [];
  const chosen =
    targets.find((x) => /^done$/i.test(x.name)) ||
    targets.find((x) => x.to?.statusCategory?.key === "done") ||
    targets.find((x) => /close|resolve|complete/i.test(x.name));
  if (!chosen) return { ok: false, reason: `no Done transition. names: ${targets.map(x => x.name).join(", ")}` };
  const r = await api("POST", `/rest/api/3/issue/${key}/transitions`, { transition: { id: chosen.id } });
  if (r.status >= 400) return { ok: false, reason: `transition POST ${r.status}: ${JSON.stringify(r.body).slice(0, 200)}` };
  return { ok: true, name: chosen.name };
}

const SCRUM_191_RESOLUTION = `Resolved — root cause identified and fully replaced.

Root cause: the floating teal circle at bottom-right of every dashboard page was a non-functional UI scaffold (src/components/shared/chat-widget.tsx) — a styled button with no onClick handler, no state, no provider, wired to nothing. As a fixed-position 56px element at bottom-right of the viewport, it overlapped Next / Save & Activate buttons on long forms (Overview, Documents, Questionnaire) when scrolled to the end.

What shipped:

(1) Increased dashboard main bottom padding to 96px so any future fixed-position element won't overlap (commit 65c033e — landed before the assistant work).

(2) Removed the dead chat widget component entirely.

(3) Replaced it with a real in-app AI assistant — "Need help?" button now lives in the dashboard header (top-right, beside your name/avatar). It never overlays content and never blocks buttons. Click it to open a chat side-panel that knows which module/step you're on and answers questions about the platform.

Backend is auth-gated, validates input with Zod, sanitises through the prompt-injection guard, and routes through the existing callModel() infrastructure (haiku → gpt-4o-mini → sonnet fallback, cost-sensitive for high-volume chat).

Karen — please hard-refresh (Ctrl+Shift+R) on https://mmcbuild-one.vercel.app and look at the top-right of the header on any dashboard page. You should see "Need help?" as an outline button with a question-mark icon, sitting just to the left of your name/role. Click it to try the assistant. The original button-overlap behaviour you reported is no longer possible because the floating element is gone entirely.

Commits: 65c033e (padding fix) → a78fb93 (replace dead widget with Need Help assistant). Production: a78fb93 deployed to mmcbuild-one.vercel.app.

Closing. New ticket logged separately for the assistant build itself so it's tracked as feature work, not just a bugfix.`;

const ASSISTANT_DESCRIPTION = `Build the in-app "Need help?" AI assistant that replaced the dead floating chat widget (root cause of SCRUM-191).

Scope shipped (production a78fb93):

UI:
- "Need help?" outline button in the dashboard header (top-right, beside the user name/avatar). Never overlays content, never blocks buttons — directly addresses the SCRUM-191 class of bug.
- Click opens a right-side Sheet (shadcn) with a chat interface — message history, textarea input, send button, "Thinking…" spinner, error banner.
- Page-aware: passes usePathname() with each request so the assistant knows which module/step the user is on (e.g. "user is currently on MMC Comply: NCC compliance checker..."). Replaces dumb floating chat with context-aware help.

Backend (POST /api/assistant/chat):
- Auth-gated via supabase.auth.getUser() — returns 401 if unauthenticated.
- Input validated with Zod (chatRequestSchema in src/lib/assistant/validators.ts).
- Every user message run through security-gate.sanitize() before reaching the model — prompt-injection patterns stripped per existing platform pattern.
- Routes through callModel() — added "assistant" to the AIFunction union with chain claude-haiku-4.5 → gpt-4o-mini → claude-sonnet-4. Haiku-first because chat is high-volume and cost-sensitive (~$1/M input vs $3 for Sonnet).
- maxTokens 800 (short answers).

Files added:
- src/lib/assistant/validators.ts — Zod schemas
- src/lib/assistant/page-context.ts — pathname → module description mapping
- src/lib/assistant/system-prompt.ts — system prompt builder with platform overview + style rules
- src/app/api/assistant/chat/route.ts — POST endpoint
- src/components/ai-assistant/help-button.tsx — header trigger + Sheet panel + chat UI

Files modified:
- src/lib/ai/models/registry.ts (AIFunction union)
- src/lib/ai/models/router.ts (routing chain)
- src/components/dashboard/header.tsx (mount HelpButton)
- src/app/(dashboard)/layout.tsx (remove dead ChatWidget mount)

Files deleted:
- src/components/shared/chat-widget.tsx (the dead button)

Out of scope for v1 (intentional):
- No streaming (request/response only — feels OK for short answers)
- No conversation persistence (each Sheet open starts fresh)
- No RAG hookup against the NCC knowledge base — system prompt has platform overview only
- No usage limits / paywall on the assistant route

Future direction (not committed):
The page-context + system-prompt structure makes it straightforward to invert into "what do you want to do?" mode — give the assistant tools (start_compliance_check, open_project, request_quote), drop the user on /dashboard with the assistant open by default. That's a real feature, not a scaffold extension — would replace the persona/structured-views approach.

Marking Done — feature scaffold is in production and Karen has the deployed URL to retest.`;

async function main() {
  console.log(`SCRUM-191 resolution + assistant ticket creation on ${HOST}\n${"=".repeat(60)}\n`);

  // 1. SCRUM-191 — comment + transition
  console.log("[1/4] SCRUM-191: posting resolution comment");
  const c = await api("POST", `/rest/api/3/issue/SCRUM-191/comment`, { body: adfDoc(SCRUM_191_RESOLUTION) });
  if (c.status >= 400) {
    console.error(`  ✗ comment FAIL ${c.status}: ${JSON.stringify(c.body).slice(0, 200)}`);
    process.exit(1);
  }
  console.log("  ✓ comment posted");

  console.log("[2/4] SCRUM-191: transitioning to Done");
  const t = await transitionToDone("SCRUM-191");
  if (!t.ok) {
    console.error(`  ✗ ${t.reason}`);
    process.exit(1);
  }
  console.log(`  ✓ transitioned → ${t.name}`);

  // 2. Resolve Dennis's account ID
  console.log("\n[3/4] Resolving Dennis account ID");
  const me = await api("GET", "/rest/api/3/myself");
  const dennisId = me.body?.accountId;
  if (!dennisId) {
    console.error(`  ✗ failed to resolve /myself: ${JSON.stringify(me.body).slice(0, 200)}`);
    process.exit(1);
  }
  console.log(`  ✓ Dennis: ${dennisId}`);

  // 3. Create new ticket + transition
  console.log("\n[4/4] Creating assistant feature ticket");
  const create = await api("POST", "/rest/api/3/issue", {
    fields: {
      project: { key: PROJECT_KEY },
      summary: 'Build in-app "Need help?" AI assistant',
      description: adfDoc(ASSISTANT_DESCRIPTION),
      issuetype: { name: "Story" },
      labels: ["feat", "assistant", "ai", "v0.4.0", "replaces-scrum-191"],
      priority: { name: "Medium" },
      assignee: { accountId: dennisId },
    },
  });

  if (create.status >= 400 || !create.body?.key) {
    console.error(`  ✗ create FAIL ${create.status}: ${JSON.stringify(create.body).slice(0, 400)}`);
    // If Story type rejected, retry as Task
    if (JSON.stringify(create.body).includes("issuetype")) {
      console.log("  retrying as Task...");
      const retry = await api("POST", "/rest/api/3/issue", {
        fields: {
          project: { key: PROJECT_KEY },
          summary: 'Build in-app "Need help?" AI assistant',
          description: adfDoc(ASSISTANT_DESCRIPTION),
          issuetype: { name: "Task" },
          labels: ["feat", "assistant", "ai", "v0.4.0", "replaces-scrum-191"],
          priority: { name: "Medium" },
          assignee: { accountId: dennisId },
        },
      });
      if (retry.status >= 400 || !retry.body?.key) {
        console.error(`  ✗ retry FAIL ${retry.status}: ${JSON.stringify(retry.body).slice(0, 400)}`);
        process.exit(1);
      }
      create.body = retry.body;
      create.status = retry.status;
    } else {
      process.exit(1);
    }
  }

  const newKey = create.body.key;
  console.log(`  ✓ created ${newKey}`);
  console.log(`    https://${HOST}/browse/${newKey}`);

  console.log(`  transitioning ${newKey} → Done`);
  const t2 = await transitionToDone(newKey);
  if (!t2.ok) {
    console.error(`  ✗ ${t2.reason}`);
    process.exit(1);
  }
  console.log(`  ✓ transitioned → ${t2.name}`);

  console.log(`\n${"=".repeat(60)}\nDone.`);
  console.log(`  SCRUM-191 → closed with resolution`);
  console.log(`  ${newKey} → created as Done (assigned to Dennis)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
