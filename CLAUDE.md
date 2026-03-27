# MMC Build — Project Instructions

## What is this?
AI-powered compliance and construction intelligence platform for Australian residential construction. Built for Global Buildtech Australia Pty Ltd (GBTA) on behalf of MMC Build Pty Ltd.

## Tech Stack
- **Frontend/API**: Next.js 16 (App Router, TypeScript strict, Tailwind CSS, shadcn/ui)
- **Database**: Supabase (PostgreSQL + pgvector + Auth + Storage + RLS) — Sydney region
- **Jobs**: Inngest (async AI pipelines, cron)
- **AI**: Anthropic Claude (primary), OpenAI (embeddings)
- **Payments**: Stripe (test mode for MVP)
- **Deployment**: Vercel

## Key Commands
- `pnpm dev` — Start dev server
- `pnpm build` — Production build
- `pnpm lint` — ESLint
- `pnpm test` — Run vitest unit tests
- `npx tsc --noEmit` — Type check

## Architecture Notes
- RLS enabled on every table — org-scoped access via `get_user_org_id()` helper
- Server Components by default; Client Components only when needed
- Server Actions for mutations
- Inngest for any job > 5 seconds
- All AI API keys server-side only
- Zod for all input validation
- Shared `db()` helper at `src/lib/supabase/db.ts` for tables not in generated types
- Stripe billing: paywall at both middleware (UX) and Server Action (correctness)
- All AI calls route through `callModel()` from `src/lib/ai/models/router.ts`

## Six Modules
1. MMC Comply — NCC compliance checking (Stage 2)
2. MMC Build — Design optimisation (Stage 3)
3. MMC Quote — Cost estimation (Stage 4)
4. MMC Direct — Trade directory (Stage 5)
5. MMC Train — Training modules (Stage 6)
6. Billing — Stripe subscriptions (Stage 7)

## Current Status
- Stage 0: Foundation scaffold — COMPLETE
- Stage 1-2: MMC Comply — COMPLETE (AI compliance, RAG, cross-validation, agentic workflow)
- Stage 3: MMC Build — COMPLETE (design optimisation, 3D viewer)
- Stage 4: MMC Quote — COMPLETE (agentic cost estimation)
- Stage 5: MMC Direct — COMPLETE (trade directory)
- Stage 6: MMC Train — COMPLETE (LMS, AI content generation)
- Stage 7: Billing — IN PROGRESS (Stripe subscriptions, paywall, usage metering)

## Testing
- Framework: Vitest
- Run: `pnpm test`
- Test dir: `tests/unit/`, `tests/integration/`
- When writing new functions, write a corresponding test
- When fixing a bug, write a regression test
