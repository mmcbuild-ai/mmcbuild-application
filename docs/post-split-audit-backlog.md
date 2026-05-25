# Post-Split Audit Backlog

**Date:** 2026-05-25
**Context:** Captured from the canonical audit (`/review`, `/cso`, `/naive-tester`) run over the `mmc-market → mmcbuild-application + mmcbuild-marketing` split, plus the app fix pass that followed. This is the "do later" list — none of it blocks the canonicals re-run, performance pass, or the Karthik migration.

---

## ✅ Done (shipped this session — for reference)
- Brochure: self-host base44 images, favicon, 44px inputs (`8b1ed0c`).
- Security: CORS scoped to the marketing project, off `*.vercel.app` (`9cdf641`); HubSpot `sourcePage` sanitizer (`087444d`).
- App: auth-cookie `secure` hardened (env-conditional); "MMC Direct" naming unified in-app; sidebar `text-[11px]` fixed (`468433e`).
- App: dashboard never-blank fallback (`e957d5a`).
- App: editable Profile — name + password change (`382c8a2`).
- Lead pipeline + sender verified end-to-end; HubSpot fix is a **domain-allowlist** (Karthik, per the emailed draft), not code.
- **QA test infra** — persistent `owner` QA account (`mcmdennis+qa@gmail.com`, password in password manager), `scripts/qa-session.mjs` (real-session cookie minter — no auth bypass), `docs/TESTING.md` (Mode A type-the-form / Mode B inject-the-cookie + daemon workaround).
- **Canonicals re-run on the updated site — all 5 + performance landed:** `/review` ✅ clean, `/cso` ✅ clean (CORS closed), `/voice-auditor` ⚠️ partial (pre-existing DNA gap, see Voice below), `/benchmark` (see Performance below), `/naive-tester` verify ✅ — **every previously-reported landmine confirmed gone for a real provisioned user** (dashboard renders, `/beta` 200, billing 200, Profile editable; brochure favicon/headshots/hero/44px-inputs/handoff all ✅).

## ⏳ Deferred — needs a decision or a prod-DB touch
- **Profile `phone` / `company` / `job_title` + email-change.** Requires an additive migration on the **live CAS prod DB** (`skyeqimwnyuuozvhubdc`, Karen's data) + the international phone input + the email re-verification flow. Confirm the repo is linked for `supabase db push` first (no `supabase/migrations` profiles def found — schema may be dump-only). Core §4 (name + password) is already done.

## 🛡️ Hardening backlog (no known active hole — defence-in-depth)
- **CSP (Content-Security-Policy)** — the compensating control for the non-`httpOnly` Supabase cookie. Dedicated task: enumerate all external sources (ElevenLabs voice, Mapbox, Stripe, three.js, HeyGen, Supabase, HubSpot…) → roll out `Report-Only` → test every integration → enforce. Do NOT rush (a too-strict CSP silently breaks the voice agent / maps / checkout).
- **Rate-limit `/api/leads` (+ `/api/abn-lookup`)** — reuse the `trustGate` IP-hash pattern already on `/api/estimate`. (cso LOW — financial amplification, not DoS.)
- **Sanitize `/api/remediation/[token]/upload`** — basename the filename + enforce a MIME/extension allowlist (keep the 10MB cap). (cso MEDIUM.)
- **`/beta` + Billing graceful no-profile state** — only reachable by a profile-less user (provisioning edge case the dashboard fallback already guides). Low value; tidy if convenient.

## ⚡ Performance (from `/benchmark` + naive-tester env notes)
- **Brochure: ship-quality** ✅ — TTFB ~200ms, LCP 1.3–1.9s, CLS 0, 174KB JS. Quick win: lazy-load + responsive-size the ~54 below-fold images (4.3MB cold-load; doesn't hit LCP, so not a blocker).
- **App `/login`: slow cold paint** 🟡 — LCP ~3.9s cold / 2.1s warm, from **app-shell JS hydration** (not bundle size — 161KB). Render `/login` as a lighter route so first paint isn't gated on full-shell hydration. Real, perf-polish (not a blocker).
- **Login submit has no loading state** 🟡 (both `/benchmark` cold-paint + Anneke flagged it) — the sign-in server action sits "pending" several seconds with no spinner; a real user clicks Sign In and sees nothing. **Quick UX win:** add a loading/disabled state + spinner to the login + magic-link submit buttons. Highest-value of the perf items (every user hits it at the gate).
- **App `/dashboard`: unmeasured by `/benchmark`** — the benchmark daemon couldn't hold a session (DOM-injection quirk). Creds confirmed valid via password-grant + Anneke logged in manually, so this is a harness limitation, not a bug. The new `scripts/qa-session.mjs` (Mode B) fixes future authed-perf runs.
- **Brochure: two custom dropdowns are 36px on mobile** 🟡 (country-code + Role on the contact form) — just under the 44px target; the rest of the form passes. Quick bump.

## 🎙️ Voice agent (VOICE AI standard — pre-existing gap, not a split regression; from `/voice-auditor`)
- **App `voice_agent_status` = partial.** The voice widget is a CDN `<elevenlabs-convai>` one-off in `(dashboard)/layout.tsx`, not the `@caistech/elevenlabs-convai` hub `/react` VoiceWidget. Backfill onto the hub; move the agent id into a scaffolded `voice.config.ts` (not `NEXT_PUBLIC_ELEVENLABS_AGENT_ID`).
- **⚠️ Verify the agent id.** The hardcoded fallback `agent_8401ksadmdx1f1arf6xeq5spk2qf` is a rehearsals-ai/distributor stand-in, **not an MMC Build agent**. Provision a dedicated MMC BYOK agent, set its Security allowlist (prod domain + `*.vercel.app` + `localhost:3000`), and confirm the env var points at it (else the live widget uses the wrong agent on the operator's key).
- **Memory loop = none** (greeter only): no recall/persist, no convai webhook → no HMAC, no memory tables, identity not server-derived. Wire the **Comply-intake clarifier** (`useConversation` + `sendContextualUpdate`, surface + draft aware — the Required surface's real need); add the memory webhook (HMAC, per `VOICE_MEMORY_STANDARD`) if cross-session memory is wanted.
- **Brochure `voice_agent_status` = absent.** `chatbot.tsx` is a canned `setTimeout` stub branded "MMC Build AI Assistant" — de-brand to an honest contact CTA **or** replace with the hub VoiceWidget. Don't ship a fake labelled "AI."

## 📣 Content / branding (Karen's call — not engineering)
- **Complete the "MMC Direct" rename (Karen's decision: everywhere, or in-app-only with "Directory" as the public descriptor).** In-app module is already "MMC Direct" (sidebar, `/direct` heading, module-themes, Stripe). The `/review` re-check found **13 stale "MMC Directory"/"Trade Directory" refs** still to decide on: marketing pages (`(marketing)/layout.tsx`, `products`, `page.tsx`, `pricing/pricing-client.tsx`, `mmc-suppliers`, `mmc-directory`), the waitlist-form `directory` option label, the enquiry/review **email templates** ("Sent via MMC Build Trade Directory"), and `testing-guide.tsx`. Also decide whether the `/mmc-directory` URL slug changes (SEO/redirect). Public-branding + transactional-copy = Karen's call.
- **Marketing credibility:** Tier-1 partner logos (real or reframe — legal risk if aspirational); round-number stats + unattributed testimonials; "industry-recognised certifications" accreditor; the "up to 60%" claim footnote; reconcile the hero "Join the Waitlist" vs corner "Get Started".

## 🔜 Process — next, in order (per Dennis 2026-05-25)
1. ✅ **Re-run canonicals on the *updated* site** — DONE. `/review` + `/cso` + `/voice-auditor` + `/naive-tester` verify all landed; no blockers (voice = pre-existing DNA gap, backlogged).
2. ✅ **Performance standards** — `/benchmark` DONE. Brochure ship-quality; app `/login` cold-paint + login-spinner are perf-polish items (above), not blockers.
3. **→ Karthik migration re-plan** — **gate now open.** 1 + 2 are clean (only deferred/backlog items remain). This is the next phase.

## 🧹 Cosmetic
- Rename the legacy `MMCBuild` local folder → `_deprecated-mmcbuild` (the GitHub repo is already archived; the local rename is pending a file lock — do after a reboot).
