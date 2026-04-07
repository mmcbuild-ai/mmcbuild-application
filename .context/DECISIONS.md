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

_Next ADR number: ADR-007_
