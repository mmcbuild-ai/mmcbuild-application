# MMC Build — Architecture Decision Records

_Maintained by Dennis McMahon. Referenced from PROJECT_STATE.md._

---

## ADR-001: Next.js / Vercel / Supabase over PRD-specified AWS/FastAPI

**Status:** Final
**Date:** 2026-02-24
**Context:** PRD v3.0 specified FastAPI (Python), AWS ECS/Fargate, Celery/SQS, OpenSearch, Redis, Terraform. This is enterprise-grade but heavyweight for an MVP targeting 5-10 pilot firms.
**Decision:** Replace with Next.js (full-stack TypeScript), Vercel (hosting), Supabase (PostgreSQL + pgvector + Auth + Storage + RLS, Sydney region), Inngest (async jobs). Single language, 3-4 services instead of 8-10.
**Rationale:**
- 4-6 weeks of infrastructure work saved
- $50-75/month at MVP scale vs $300-500+ for AWS stack
- No vendor lock-in (Next.js is open source, Supabase is open-source PostgreSQL)
- AU data residency satisfied (Supabase Sydney + Vercel edge)
- R&D Tax Rebate eligibility unaffected by hosting choice
**Consequences:** AWS migration path encoded in DB migrations for post-MVP enterprise customers if needed.

---

## ADR-002: All six modules built simultaneously

**Status:** Final
**Date:** 2026-03-10
**Context:** Original plan was sequential delivery over 14 weeks. Modules share significant infrastructure (auth, RLS, Inngest, AI routing).
**Decision:** Build all six modules (Comply, Build, Quote, Direct, Train, Billing) near-simultaneously, sharing common patterns.
**Rationale:** Shared infrastructure (db helpers, AI router, Inngest patterns) meant marginal cost of each additional module was low once the first was built. All 6 delivered by Week 5 of 14.
**Consequences:** Faster delivery but broader surface area for QA. Client review covers all modules at once.

---

## ADR-003: R&D evidence module with clean architectural separation

**Status:** Active
**Date:** 2026-03-05
**Context:** AusIndustry R&D Tax Incentive requires contemporaneous evidence. Platform already generates evidence (AI calls, experiments, hypotheses) as a byproduct.
**Decision:** Build R&D tracking as a cleanly separated module (hypothesis -> experiment -> evidence -> artifact chain) that could be extracted as standalone SaaS in future.
**Rationale:** Dual value — satisfies R&D tax evidence requirements for MMC Build AND creates IP for potential standalone product.
**Consequences:** Extra tables and logging overhead, but evidence generation is mostly automated via Inngest.

---

## ADR-004: Inngest for cron and webhook infrastructure

**Status:** Final
**Date:** 2026-02-28
**Context:** Need async job processing for AI pipelines (compliance analysis, cost estimation, report generation) that take 30s-2min. Also need cron for nudge system and data sync.
**Decision:** Inngest over Celery/SQS (PRD spec) or Trigger.dev.
**Rationale:** Native Next.js integration, durable step functions with built-in retry, visual dashboard for job monitoring, no separate worker infrastructure.
**Consequences:** 15 async functions deployed. Nudge system (12 nudges) runs on Inngest cron.

---

## ADR-005: Resend for email, Stripe for billing

**Status:** Final
**Date:** 2026-03-01
**Context:** Need transactional email (notifications, certificates, nudges) and payment processing.
**Decision:** Resend for email (simple API, good DX), Stripe for billing (industry standard, webhook-driven).
**Rationale:** Both have excellent Next.js integration. Stripe embedded checkout keeps users on-domain. Resend is simpler than SES/SendGrid for MVP volume.
**Consequences:** Stripe in test mode until price IDs created by client. Resend handles nudge emails to Karen.

---

## ADR-006: Multi-model AI routing with fallback chains

**Status:** Final
**Date:** 2026-03-15
**Context:** Single-model dependency creates vendor risk and limits cost optimisation.
**Decision:** 6-model registry across 3 providers (Anthropic Claude, OpenAI, HuggingFace). Function-to-model routing via `callModel()` in `src/lib/ai/models/router.ts`. Automatic fallback chains.
**Rationale:** Haiku for lightweight tasks, Sonnet for analysis, GPT-4o for validation, HuggingFace BGE for reranking. Cost tracking per call. No single-vendor dependency.
**Consequences:** More complex routing logic but production resilience. AI usage logged to `ai_usage_log` table.

---

## ADR-007: Repo topology — `mmc-marketing` (public web) + `mmc-application` (product + services)

**Status:** Proposed — to confirm with Karthik on the 2026-05-24 call
**Date:** 2026-05-24
**Context:**
- SCRUM-195 (Karthik's signed-off migration design doc) specified **two code repos: "web + app"** — public marketing site separate from the application — plus the feature→release→main branching model.
- On **13 May** we consolidated them into a single repo (`mmc-market`, absorbing the old `mmcbuild-webapp` marketing content) to simplify the migration. The separate shared-services repo (`mmc-shared`) was added later (2026-05-15, Option B) as Dennis's preference for updating the services layer independently.
- On 2026-05-24 Karthik's org deploy failed (missing Supabase env var + unpublished `@mmcbuild-ai` packages) and he asked to **separate marketing from application** for failure containment. This restores SCRUM-195's `web + app` — it is **not new scope**.
- A linguistic mismatch surfaced: "market" was read by Dennis as the whole webapp and by Karthik as the thin public UI, and it collides with "MMC Direct marketplace." This ADR exists in part to kill that ambiguity permanently.

**Decision:** Two repos. Retire the name "market" and the separate `mmc-shared` repo.

1. **`mmc-marketing`** (Karthik's "web") — the **public brochure site**. No Supabase, no auth. Deploys to `mmcbuild.com.au`.
2. **`mmc-application`** (Karthik's "app") — the **product**: everything that touches Supabase. The shared services fold in as internal modules. Deploys to `app.mmcbuild.com.au`.

**THE ONE RULE (resolves any "which repo?" question):**
> If a page or route **talks to Supabase**, it belongs in **`mmc-application`**. If it's **brochure-ware** (no database, no login), it belongs in **`mmc-marketing`**.
> Corollary: *public ≠ marketing.* A public page can still live in `mmc-application` — the public instant-estimate hits the database, so it is part of the application.

**Exactly what's in each (current path → target repo):**

`mmc-marketing` — public web, **NO Supabase**:
- `src/app/(marketing)/*` (landing / about / pricing). The current `(marketing)/page.tsx` imports Supabase for session-aware nav — that coupling is removed; nav becomes a static link to the app.
- marketing-only layout + components
- its own minimal copy of brand/design tokens + Tailwind config (see Consequences — no third "shared UI" repo)
- public static assets (logos, OG images)

`mmc-application` — the product, **Supabase-coupled**:
- `src/app/(auth)/*` — login, signup, `auth/callback`
- `src/app/(dashboard)/*` — comply, build, quote, direct, train, billing, settings/* (team, knowledge, rd-tracking, profile, cost-rates, organisation, ai-performance, directory-admin), projects, admin/* (test-regime, directory), beta, dashboard
- `src/app/api/*` — estimate, remediation/[token], comply/build/quote reports, rd/webhook, assistant/chat, webhooks/stripe
- `src/app/respond/[token]/*` — public remediation responder (Supabase-backed → application, despite being public)
- the public **`/estimate`** page + `/api/estimate` (Supabase-backed → application, despite being public)
- `src/lib/*` — all of it (inngest functions, estimation, comply, knowledge, ai routing, site-intel, auth/seats)
- `src/components/*` — full design system + module components
- **Folded-in services** (formerly `mmc-shared`): `mapbox`, `platform-trust-middleware`, `property-services-sdk`, `elevenlabs-convai` → internal modules under `src/lib/services/*`, **NOT** published packages
- `supabase/migrations/*`, Inngest, Stripe, Resend config

Retired:
- `mmc-shared` (org repo) — archived once services are folded in
- `mmcbuild-webapp` (legacy standalone marketing) — already superseded by the 13 May consolidation
- the name `mmc-market` — renamed to `mmc-application` (it is ~90% application code already)

**Rationale:**
- Restores the signed-off SCRUM-195 `web + app` end-state — not new scope.
- Gives the failure-containment Karthik asked for: two independent deploys; a broken app build cannot take the public site down.
- **Folding services into the app removes the package-publishing step that caused the 2026-05-24 deploy failure** (no registry, no `@mmcbuild-ai` publish, no token, no version mismatch). Turbopack + `pnpm link:` cannot resolve local symlinks, so a separate repo *forces* publishing — folding-in sidesteps that entirely.
- MMC Build's services are a single-consumer, trimmed fork that diverges from Dennis's `@caistech` portfolio post-handover anyway; independent package versioning is over-engineering for one consumer.

**Consequences:**
- **Cut direction:** `mmc-market` (mostly app) is **renamed** `mmc-application`; the thin marketing slice is **lifted out** into a new `mmc-marketing`. Move the small piece — do not carve the app out.
- **Shared UI:** design-system components used by both sites are duplicated as a minimal set into `mmc-marketing` (a thin brochure), rather than creating a third shared-UI repo. Accept minor token duplication.
- **Lost capability:** services are no longer independently versioned. Acceptable for a single-consumer handover; Dennis keeps the canonical services as `@caistech/*` for the rest of the portfolio and copies relevant changes down.
- **Deploys/DNS:** `mmcbuild.com.au` → `mmc-marketing`; `app.mmcbuild.com.au` → `mmc-application`. Supabase Auth redirect URLs updated to the app subdomain.
- **Timing:** the env-var fix (Supabase keys + package resolution) is the go-live blocker and lands first; the repo restructure is done deliberately in the Mon–Tue window with the backend migration. The deploy failure does NOT force the restructure tonight.
- **Naming to confirm with Karthik on the 2026-05-24 call** (web/app vs marketing/application) — but the *contents* and *the one rule* above are the substance.

---

_Next ADR number: ADR-008_
