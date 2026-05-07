# MMC Build — Engineering Guardrails and Process

**Audience:** Karthik (for cross-check into the VC due-diligence pack — SCRUM-205) and, by inheritance, prospective investors and auditors.

**Purpose:** Document the conventions, security guardrails, and review processes already enforced in the MMC Build codebase, so they can be presented honestly during diligence rather than reverse-engineered from the repo. Where a guardrail is partial or deferred, this doc says so explicitly.

**Maintained alongside:**
- `CLAUDE.md` (project root) — the live, machine-readable version of these conventions; updated whenever a convention is added or changed.
- `~/.claude/CLAUDE.md` (developer-side global) — applies cross-project, REGULATED-tier rules for MMC Build are the strictest tier defined there.

This document is the human-readable distillation. If it disagrees with the code, **the code is the source of truth** — please flag any drift back to Dennis.

---

## 1. Risk tier — REGULATED

MMC Build is classified internally as a **REGULATED-tier** project (alongside platform-trust, ndissda-automate, f2k-checkpoint, f2k-fund-tokenisation, r-and-d-tax, disaster-support). Rules:

- Zero tolerance for convention drift.
- Mandatory read-before-edit on every file touched.
- No "simplest fix" shortcuts — compliance logic must be correct, not convenient.
- Ambiguity is flagged, not assumed.
- Paywall and billing logic verified at both middleware (UX) AND Server Action (correctness).

The classification exists because the platform produces compliance findings against the National Construction Code (NCC), is positioned for sale to architects and designers handling regulated building plans, and stores client documents that may be subject to audit. Convention violations have higher real-world cost here than in a typical SaaS.

---

## 2. Branch model and code review (agreed 2026-05-06)

Three-stage workflow on the production GitHub repo (to be set up as part of the Base44 → Vercel migration in Sprint 6/7):

1. **`feature/<short-slug>`** — Dennis pushes work-in-progress.
2. **`release`** — PR from `feature`, requires approval from Karthik or Karen + Dennis. Reviewers check the diff against the test results and the change rationale.
3. **`main`** (or `master` on Bitbucket-style mirrors) — PR from `release`, requires a second approval. Protected: no direct pushes, no force-pushes.

Future addition (deliberately deferred until the platform is more complex per the meeting): automated test gating on the release branch — release → main only proceeds if CI passes.

GitHub branch protection rules and required reviewers will be enforced at the platform level once the MMC Build repo is provisioned (SCRUM-201, SCRUM-206).

Until that's in place, the equivalent discipline runs at the local commit level: small commits with explicit messages, no `--no-verify`, no signed-bypass, no force-push.

---

## 3. Read-before-edit and change discipline

Mandatory before any file is edited:

1. Read the target file in full.
2. Read all files that import from or are imported by it.
3. Grep for all usages of any symbol being modified.
4. Read the relevant tests and the closest `CLAUDE.md` for project conventions.
5. State the reading plan before any edit.

Forbidden:
- Editing a file without reading it in the current session.
- Full-file rewrites where a surgical edit would suffice.
- Making the same edit to the same file more than twice without re-reading it.
- "Quick fixes" that bypass conventions for speed.

Why this matters for diligence: every line of compliance logic has a reason. Drift from existing conventions is how regulated-product bugs sneak in. The read-before-edit rule has caught real cases of mocks-target-the-wrong-client, paywall-checked-only-in-middleware, and silently-swallowed-errors during this project.

---

## 4. Authentication

Every route handler that accesses user data starts with:

```ts
const { data: { user }, error } = await supabase.auth.getUser();
if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
```

Rules:
- Never infer auth from session cookies alone — always call `getUser()` against Supabase.
- Cookies that fail signature verification are treated as unauthenticated.
- Public endpoints are explicitly listed and reviewed (see Section 9).

Supabase Auth is configured for email + password and email magic-link flows. Session lifetime, refresh, and rotation are handled by Supabase server-side; the app does not store its own session state.

---

## 5. Authorisation, RLS, and database access

### Row-Level Security (RLS)

- **RLS is enabled on every application table.** This is verified in migration files and is part of the deploy checklist.
- RLS is never disabled, even temporarily for debugging. If a query returns no rows unexpectedly, the policy is checked before the data is assumed missing.
- The `get_user_org_id()` SQL helper is used in policies for org-scoped access. Per-table access logic is not duplicated; it composes from this helper.

### Three Supabase client surfaces

- `createClient()` from `src/lib/supabase/server.ts` — used inside Server Components and route handlers; subject to RLS as the authenticated user.
- `db()` from `src/lib/supabase/db.ts` — typed admin helper for tables not yet in generated types. Wraps `createAdminClient()`.
- `createAdminClient()` from `src/lib/supabase/admin.ts` — service-role access. Used **only** in server-side code where elevated access is explicitly required (RLS bypass).

**Hard rule:** the admin client is never imported into a file that has or could have `"use client"`. This is a guard against accidental service-role exposure to the browser bundle. Linted by inspection during PR review.

### Service role key

`SUPABASE_SERVICE_ROLE_KEY` is server-side only. It is never:
- Prefixed with `NEXT_PUBLIC_*`.
- Imported into client components.
- Logged.
- Returned from any API route or Server Action.

### Migrations

- Migrations live in `supabase/migrations/`.
- Migrations are idempotent — `CREATE` statements are wrapped in exception handlers or use `IF NOT EXISTS` so re-running is safe.
- Schema changes that affect RLS policies are reviewed alongside the policy migration in the same PR.

---

## 6. Paywall enforcement (double-layer)

Paywalls are enforced at two independent layers:

1. **Middleware** (`src/middleware.ts`) — for UX redirect; an unauthorised user hitting a paid page is redirected to billing.
2. **Server Action / API Route** — for correctness; the gate is re-checked before any state change.

The middleware check is **not sufficient on its own**. An attacker bypassing the middleware (e.g., calling a Server Action directly) hits the unguarded action without the second layer. Both layers are required.

Pattern in any module action:

```ts
const usage = await checkAndIncrementUsage(orgId, 'comply');
if (!usage.allowed) return { error: 'usage_limit_reached', limit: usage.limit };
```

Increment is atomic via a Postgres function (`increment_usage`) — checking and incrementing in a single round-trip prevents race-condition over-runs.

---

## 7. AI safety

### All AI calls go through one router

Every AI call — Anthropic, OpenAI, future providers — goes through `callModel()` in `src/lib/ai/models/router.ts`. Direct SDK calls from routes or actions are forbidden.

The router handles:
- Model fallback (if primary errors out).
- Usage tracking (token counts, latency, cost estimation per call).
- Cost estimation (logged for billing reconciliation).

This means we know what every AI call cost us and can prove it during diligence.

### Prompt injection guard

The compliance AI pipeline processes user-uploaded building plans, which are inherently untrusted content. **Every** path that inserts user-derived content into an AI prompt routes through `src/lib/security-gate.ts` first.

The gate:
- Strips known prompt-injection patterns.
- Rejects content above a length threshold (defence against context overflow attacks).
- Logs rejected payloads (without storing the rejected content itself) for review.

Bypassing the gate "for efficiency" is forbidden. Every Comply / Build / Quote AI action is verified to call it.

---

## 8. Webhook signature verification

Two webhook surfaces, both signature-verified:

| Endpoint | Source | Mechanism |
|---|---|---|
| `/api/webhooks/stripe` | Stripe | `Stripe.webhooks.constructEvent()` with `STRIPE_WEBHOOK_SECRET` |
| `/api/rd/webhook` | GitHub | HMAC-SHA256 over raw body with shared secret |

Both follow the pattern: **read raw body → verify signature → parse JSON**. Verification before parse is non-negotiable — a malicious payload should never be deserialised.

Signature verification is never disabled, even in development, except via explicit fixture-based testing in Vitest.

---

## 9. Token-based public endpoints

`/api/remediation/[token]/**` uses time-limited bearer-style tokens instead of Supabase auth. These endpoints are intentionally publicly accessible (recipients of remediation emails are not necessarily logged-in users).

Constraints:
1. Every request validates `expires_at` server-side. Expired tokens are rejected.
2. The token value is **never** logged or returned in error messages.
3. Token scope is fixed — a remediation token can read its associated remediation record and accept the remediation; it cannot perform unrelated operations.
4. Tokens are single-purpose and tied to a specific remediation_id.

Any change to this surface requires a re-review of points 1–3.

---

## 10. Input validation

All user inputs entering Server Actions or API routes are validated with **Zod** before use. Validators are organised per-module at `src/lib/<module>/validators.ts` (e.g. `src/lib/direct/validators.ts`, `src/lib/train/validators.ts`, `src/lib/assistant/validators.ts`). Inline validation is forbidden — the schema goes in the module's validators file so it can be reviewed and reused.

This includes:
- Form submissions (Zod-validated before any DB write).
- File uploads (size, type, kind detected and validated; see `src/lib/plans/file-kind.ts`).
- Webhook payloads (validated AFTER signature verification).
- Query/path parameters in API routes.

Internal-to-internal calls (one server function calling another) are not Zod-validated — trust boundary is the Server Action boundary.

---

## 11. Secrets and environment variables

| Variable group | Surface | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_*` | Public | Safe to ship in client bundle. URL + anon key only. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only | Bypasses RLS. Never exposed. |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` | Server-only | All AI calls server-side via the router. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Server-only | Webhook secret used for verification only. |
| `RESEND_API_KEY` | Server-only | Transactional email. |
| `INNGEST_SIGNING_KEY`, `INNGEST_EVENT_KEY` | Server-only | Job runner auth. |
| `CLOUDCONVERT_API_KEY` | Server-only | DWG → DXF conversion. |

Rules:
- Secrets are stored in Vercel project env (prod), `.env.local` (dev). Never in code, never committed.
- `.env.local` is gitignored.
- Any `process.env.X` reference outside the `NEXT_PUBLIC_*` namespace is treated as server-only and verified to be in a server file before merge.

---

## 12. Async / long-running work

Any operation expected to take more than 5 seconds **must** use Inngest. Reasons:
- Vercel route handlers have a 10-second timeout in serverless mode. Long synchronous work fails noisily or, worse, intermittently.
- Inngest gives us retries, idempotency keys, and observable job state — useful for compliance pipelines that may need to resume after partial failure.

Long jobs in production today:
- `run-compliance-check` (Comply pipeline)
- `run-build-check` (Build optimisation)
- `run-cost-estimate` (Quote)
- `generate-training-content` (Train)
- `process-plan` (PDF/image/DWG ingestion + extraction)
- `sync-stripe-subscription` (post-webhook reconciliation)

---

## 13. Testing

- **Frameworks:** Vitest (unit), Playwright (E2E).
- **Run unit:** `pnpm test`. **Run E2E:** `pnpm test:e2e`. **Type check:** `npx tsc --noEmit`.
- **Test directories:** `tests/unit/`, `tests/integration/`, `tests/e2e/`.
- **Bug fix discipline:** every bug fix ships with a regression test in the same PR.
- **New library function discipline:** every new function in `src/lib/` ships with a unit test.
- **Coverage target:** 30–40% minimum. Currently tracked manually; coverage gating in CI is a Sprint 6/7 candidate.

The Test Regime v1.0 (29 named test cases — see `docs/test-regime-v1.0.md`) is the formal acceptance set Karen and Karthik are reviewing this sprint (SCRUM-123 through SCRUM-152).

---

## 14. Deployment and observability

| Area | Tool / pattern |
|---|---|
| Hosting | Vercel (Sydney edge for static, Sydney serverless for API). Preview deploy per PR. |
| Database, Auth, Storage | Supabase, **Sydney region (AWS ap-southeast-2)**. Data residency: all customer data, plans, reports, and embeddings stored in Sydney. |
| Background jobs | Inngest. |
| Email | Resend. |
| Payments | Stripe (test mode for MVP; production mode is the gate for first paying customer). |
| Logs | Vercel runtime logs + Supabase logs. Application logs are intentionally low-PII (no user content logged). |
| Errors | Errors are surfaced to the user with user-safe messages; full stack traces are server-side only. |

Data residency is the headline VC point: **no customer data leaves Sydney**, including AI prompts (which transit Anthropic / OpenAI but are not persisted by them under our API terms; the source data and outputs are stored in the Sydney Supabase instance).

---

## 15. Known gaps / deferred items (honest list)

This is the section a VC will appreciate most — what *isn't* yet in place.

- **Automated release-branch test gating** — explicitly deferred per the 2026-05-06 meeting. Manual review covers it for now; automated gating is a v0.5.0 candidate.
- **Coverage gating in CI** — coverage is tracked per run, not enforced as a CI gate yet.
- **Phase 2 of seat licensing** — RLS-level enforcement of viewer-vs-editor seats is implemented at the application layer; Phase 2 (RLS-policy-level enforcement) is deferred until beta usage data is available to validate the model.
- **Per-service Workspace accounts** — the platform currently uses a small number of Google Workspace identities; per-service identities (one each for Vercel, Supabase, GitHub admin, etc.) are tracked under SCRUM-204.
- **Production GitHub branch protection** — to be enforced once the MMC Build GitHub repo is provisioned (SCRUM-201).
- **HubSpot integration on the Vercel-hosted marketing site** — currently runs through Base44; will be re-linked post-cutover (SCRUM-203).
- **DNS for `app.mmcbuild.com.au`** — pending Ventra IP cutover (SCRUM-84).
- **E2E coverage** — Playwright suite exists; coverage of critical paths (signup → trial → first compliance run → upgrade) is partial. Build-out tracked in the Test Regime v1.0.

The above is current as of 2026-05-07.

---

## 16. Where to verify each claim in this doc

For Karthik's cross-check:

| Claim | Where in repo |
|---|---|
| RLS on every table | `supabase/migrations/` |
| Auth pattern | Any file under `src/app/api/**/route.ts` |
| Three Supabase clients | `src/lib/supabase/{server,db,admin,client}.ts` |
| Paywall double-layer | `src/middleware.ts` + any module's `actions.ts` |
| AI router | `src/lib/ai/models/router.ts` (every AI consumer in `src/lib/inngest/functions/` and module actions) |
| Security gate | `src/lib/security-gate.ts`, called from compliance pipeline |
| Webhook verification | `src/app/api/webhooks/stripe/route.ts`, `src/app/api/rd/webhook/route.ts` |
| Token-based endpoints | `src/app/api/remediation/[token]/` |
| Zod validators | `src/lib/<module>/validators.ts` (per-module) |
| Inngest functions | `src/lib/inngest/functions/` |
| Test regime | `docs/test-regime-v1.0.md`, `tests/unit/`, `tests/e2e/` |

---

## Maintaining this doc

- Update `CLAUDE.md` first when a convention is added or changed; this file is downstream.
- Treat any divergence between this file and the code as a bug in this file. Code wins.
- When a "Known gap" is closed, move it from Section 15 into the relevant earlier section.
