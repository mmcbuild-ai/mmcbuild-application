# Project Status — MMCBuild

> Auto-maintained by Claude Code. Read at session start, updated before session end.
> Last updated: 2026-03-27T15:45:00Z

## Current State
**Status**: ACTIVE_DEVELOPMENT

## What Was Just Done
- Created full product scope design doc via /office-hours (APPROVED)
- Completed /plan-eng-review — architecture locked in (CLEARED)
- Completed /plan-design-review — billing UI specs complete (3/10 → 8/10)
- Stage 7 (Billing) implementation started:
  - Migration 00025_billing.sql (org billing fields + subscriptions table + atomic usage increment)
  - Stripe client, plan config, subscription status helper
  - Webhook handler (5 events) + Inngest sync function
  - Billing page with emerald theme, usage ring, plan cards, confetti success
  - Paywall in comply/actions.ts (Server Action level, atomic increment)
  - Middleware consolidated (DRY: 8 blocks → 1 array)
  - Shared db() helper extracted to src/lib/supabase/db.ts
  - Vitest set up + 14 billing tests passing
  - Trial banner, inline upgrade card, payment success components

## What's Next
- [ ] Run `pnpm build` to verify no type errors
- [ ] Verify Stripe env vars are set in .env.local
- [ ] Test full checkout flow with Stripe test mode
- [ ] Add usage analytics widget to settings/ai-performance page
- [ ] Update Supabase generated types after migration
- [ ] Run /qa for full QA pass with browser

## Blockers
- Stripe price IDs (STRIPE_BASIC_PRICE_ID, STRIPE_PROFESSIONAL_PRICE_ID) need to be created in Stripe dashboard and added to env vars

## Key Decisions Made
- Emerald/green theme for billing module
- Embedded Checkout (Stripe stays on domain)
- Paywall at both middleware (UX) + Server Action (correctness)
- Fat webhook events (no extra Stripe API calls in Inngest)
- Direct DB query for subscription status (no caching — B2B scale)
- Inline upgrade card for paywall (no modal)
- Confetti + success card for payment completion
- Trial: 60 days, 3 runs, hard cutoff

## Active Branches
- `main` — all work committed here (client project, no PR workflow)

## Environment Notes
- Vercel: deployed
- Supabase: Sydney region
- Stripe: test mode — needs STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_BASIC_PRICE_ID, STRIPE_PROFESSIONAL_PRICE_ID

## Session Log
| Date | Duration | Summary |
|------|----------|---------|
| 2026-03-27 | ~2h | Design doc, eng review, design review, billing implementation (Stage 7) |
