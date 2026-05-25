# Repo Split Migration Plan — Executing ADR-007 + ADR-008

**Status:** Ready to execute (pending the open items in §8)
**Date:** 2026-05-25
**Decision reference:** ADR-007 + **ADR-008** (`.context/DECISIONS.md`). ADR-007 sets the market/application division; **ADR-008 amends it to three repos** (`mmc-shared` kept separate, not folded in).
**Scope:** the repo restructure. The services re-externalization (§5b) and the Supabase data migration (§7) are **separate, gated workstreams** — deliberately decoupled from the marketing split so their risk is not stacked into one window.

> **What this is NOT.** A UI↔backend *network boundary* (headless backend `mmc-application`, UIs calling it over HTTP) was considered and **rejected** (ADR-008). `mmc-application` stays a **single fullstack Next.js app**. Failure containment comes from lifting the brochure into its own repo — not from headless-ifying the backend.

---

## 0. TL;DR

- **Three repos:**
  - **`mmc-marketing`** — public brochure (no Supabase, no auth) → `mmcbuild.com.au`.
  - **`mmc-application`** — the entire product (auth + dashboard UI + API + lib + components), **no network boundary**, consumes `mmc-shared` as `@mmcbuild-ai/*` packages → `app.mmcbuild.com.au`.
  - **`mmc-shared`** — shared services, kept as a separate published-package repo (`@mmcbuild-ai/{mapbox, platform-trust-middleware, property-services-sdk, elevenlabs-convai}`).
- **The one rule (ADR-007):** *talks to Supabase → `mmc-application`; brochure-ware → `mmc-marketing`.* Corollary: **public ≠ marketing** — `/estimate`, `respond/[token]`, `directory/register` are public *and* Supabase-backed → they stay in the application.
- **Cut direction:** `mmc-market` (~90% application) is **renamed `mmc-application` in place**; only the thin `(marketing)` slice is **lifted out** into `mmc-marketing`. Move the small piece.
- **Two workstreams, deliberately decoupled:**
  1. **The marketing split** (§5) — the failure-containment outcome that's actually urgent. Low-risk, self-contained, ships first. **Does not require re-externalizing services.**
  2. **Re-externalize the vendored services** to `mmc-shared` packages (§5b) — its own **later, gated** milestone, because it re-introduces the private-registry dependency that broke the org deploy on 2026-05-24.
- Neither touches the 18 Server Actions / 14 API routes / 17 Inngest functions internally.

---

## 1. End state

```
BEFORE (today)                AFTER (ADR-007 + ADR-008)
==============                =========================

mmcbuild-one.vercel.app       mmcbuild.com.au        app.mmcbuild.com.au
        |                            |                       |
        v                            v                       v
  mmc-market (one repo,        mmc-marketing          mmc-application
  services vendored in         (brochure only,        (whole product: auth +
  src/lib/services)             no Supabase/auth)      dashboard + api + lib +
                                                       components)
                                                              |
                                                              | consumes @mmcbuild-ai/*  (after §5b)
                                                              v
                                                       mmc-shared (services,
                                                       published packages)
                                                              |
                                                              v
                                                       Supabase (Sydney)  ← app only
```

A broken `mmc-application` build can no longer take `mmcbuild.com.au` down — the entire point of the split, achieved with no UI↔logic network boundary.

---

## 2. Current-state findings (verified 2026-05-25, this canonical repo)

Checked against the working tree, not assumed:

| Fact | Value |
|---|---|
| Repo identity | `origin` = `dennissolver/mmc-market`; `handover` = `mmcbuild-ai/mmc-market`; branch `main`; this **is** the canonical production source |
| Server Action files | **18** (`src/app/**/actions.ts`) — stay in `mmc-application`, unchanged |
| API routes | **14** (`src/app/api/**/route.ts`) — stay in `mmc-application` |
| Inngest functions | **17** (`src/lib/inngest/functions/*.ts`) |
| `@/lib` coupling | **458 imports across 219 files** — UI ↔ logic co-located; fine, they stay together |
| External `@caistech`/`@mmcbuild` package deps | **none** — every source import is local `@/lib/*` |
| Services state | **vendored** by a single deliberate commit (`5fca2db`, *"fold @caistech/* services into src/lib/services — drop private registry"*); **zero edits since** → no divergence from upstream yet. §5b reverses this for the 3-repo model. |
| Services blast radius | **facade pattern** — most consumers import `@/lib/platform-trust` / `@/lib/property-services` (which re-export from `src/lib/services/*`); only **mapbox** has 3 direct import sites. Re-externalizing = ~3–5 edit sites. |
| Marketing pages | **17** under `src/app/(marketing)/*` (home, about, blog, case-studies, contact, products, pricing, privacy, terms, + 6 `mmc-*` product pages) |
| Marketing Supabase coupling | **one real instance** — `(marketing)/page.tsx` (`createClient` + `redirect` session-aware landing). Form components import only the `LeadInput` **type** and POST to an API route. |

---

## 3. Cut strategy

1. **`mmc-application` = rename `mmc-market` in place.** Keep full history, every path, every secret. Remove the `(marketing)` group only after it's lifted and after internal links into it are repointed.
2. **`mmc-marketing` = a brand-new thin Next.js app** receiving the lifted `(marketing)` slice + a minimal copy of the UI primitives/brand tokens it uses. No `@supabase/*`, no auth.
3. **`mmc-shared` = the existing separate services repo** (`mmcbuild-ai/mmc-shared` per the handover docs). `mmc-application` consumes it as `@mmcbuild-ai/*` packages **after §5b**; until then the vendored `src/lib/services/*` remains the source of truth.
4. **Accept minor token/UI duplication** in `mmc-marketing` rather than a fourth "shared-UI" repo (ADR-007 consequence).

---

## 4. Exact contents per repo (current path → target)

### `mmc-marketing` — public brochure, **NO Supabase, NO auth**
- `src/app/(marketing)/*` + its layout → the marketing app's routes.
- Marketing components: `src/components/marketing/*`, `src/components/shared/module-hero.tsx`, `explainer-video.tsx`, and the `src/components/ui/*` primitives they pull in → duplicated as a minimal set.
- Brand/design tokens + `tailwind.config` + `globals.css`; public static assets (logos, OG images, favicon).
- If a brochure form has an **address field**, it may consume `@mmcbuild-ai/mapbox` (a `mmc-shared` package; public token; **not** Supabase) — allowed.
- Root metadata customised (scaffold-metadata rule): title "MMC Build", OG, favicon.

### `mmc-application` — the product, **Supabase-coupled** (everything else)
- `src/app/(auth)/*`, `src/app/(dashboard)/*`, all 14 `src/app/api/*` routes.
- `src/app/respond/[token]/*`, `src/app/directory/*`, `/estimate` + `/api/estimate` — public **but** Supabase-backed → application.
- `src/lib/*` (inngest, ai routing, comply, estimation, knowledge, site-intel, auth/seats, stripe, hubspot, email). `src/lib/services/*` is removed once §5b repoints to `@mmcbuild-ai/*`.
- `src/components/*`; `supabase/migrations/*`; Inngest registration; Stripe; Resend config.
- **All server-side secrets stay here.** `mmc-marketing` needs none.

### `mmc-shared` — services, **separate published-package repo**
- `@mmcbuild-ai/{mapbox, platform-trust-middleware, property-services-sdk, elevenlabs-convai}`, published to the MMC Build org registry; consumed by `mmc-application` (and `mmc-marketing` for mapbox only, if needed).

---

## 5. The marketing split (the urgent, low-risk workstream)

> Do the restructure **deliberately in the Mon–Tue window**. The org-mirror env/deploy fix is the go-live blocker and lands first; this restructure does not have to happen tonight (ADR-007 timing note). **This workstream does NOT depend on §5b** — the app keeps consuming the vendored services throughout.

### Phase 0 — Pre-flight
- [ ] Confirm the §8 open items.
- [ ] Branch `feat/repo-split`; tag `main` as `pre-repo-split` for one-command rollback.
- [ ] Inventory every internal app link into `(marketing)` routes (landing redirect target, "back to site") — these become absolute cross-domain links to `mmcbuild.com.au`.
- [ ] Write `feature-manifests/repo-split.json`; run `feature-preflight.mjs` to surface the Vercel/DNS/env prerequisites up front.

### Phase 1 — Stand up `mmc-application` (rename in place)
- [ ] Rename `mmc-market → mmc-application` (canonical + `handover` mirror). Update `package.json` `name` (currently `"mmcbuild"`), README, hardcoded refs.
- [ ] **No code moves, no services change** — the app keeps building exactly as today (still consuming the vendored `src/lib/services/*`).

### Phase 2 — Create `mmc-marketing` + lift the brochure
- [ ] `create-next-app` (Next 16, App Router, Tailwind v4, TS strict), **no `@supabase/*`**.
- [ ] Copy the `(marketing)` slice, marketing components, the `ui/*` primitives used, brand tokens, `globals.css`, assets. Customise root metadata.
- [ ] Build locally; assert **zero** `@/lib/supabase` imports in the marketing repo (CI grep gate).

### Phase 3 — Decouple the brochure from Supabase
- [ ] **Landing page** (`page.tsx`): remove `createClient` + session check + `redirect`; session-aware nav becomes a **static link** to `app.mmcbuild.com.au`. This is the only hard coupling.
- [ ] **Lead forms** (contact / waitlist / trades-supplier): duplicate the `LeadInput` type locally; re-point submit to the chosen target (§8 item 1) — recommended HubSpot-direct over a CORS POST to the app's `/api/leads`.
- [ ] Remove the `(marketing)` group from `mmc-application` only after `mmc-marketing` is deployed + verified and internal links are repointed.

### Phase 4 — Deploy + DNS + auth redirect
- [ ] New Vercel project: `mmc-marketing` → `mmcbuild.com.au` (apex + `www`).
- [ ] Existing Vercel project: `mmc-application` → `app.mmcbuild.com.au` (re-domained from `mmcbuild-one.vercel.app`).
- [ ] **Supabase Auth URL config** (Management API / `onboard-new-project.sh`, **not** by asking for a token): Site URL `https://app.mmcbuild.com.au`; add the app subdomain + `*.vercel.app` to the redirect allowlist; keep `auth/callback` allowlisted.

### Phase 5 — Verify + Definition of Done
- [ ] `mmcbuild.com.au`: brochure serves; `<title>` contains "MMC Build"; responsive 375px + 1440px; explanatory headers intact.
- [ ] **Auth smoke test on `app.mmcbuild.com.au`** (non-negotiable): sign-up / login / forgot-password / magic-link all land correctly under the new Site URL + allowlist.
- [ ] Dashboard, Comply/Build/Quote/Direct/Train, Stripe webhook, Inngest endpoint green on the app domain.
- [ ] Force a build break in `mmc-application` → confirm `mmcbuild.com.au` stays **up** (the containment goal).
- [ ] Brochure lead form delivers to its target. No `@supabase/*` resolves in `mmc-marketing`.

---

## 5b. Re-externalize services to `mmc-shared` — separate, gated milestone

**Why decoupled from §5.** The services are currently vendored by a *deliberate* de-risking commit (`5fca2db`, "drop private registry"). Re-externalizing **re-introduces the exact private-registry dependency that 404'd the org deploy on 2026-05-24**, so it must not be stacked into the marketing-split window (or the Supabase migration window). It makes `mmc-shared` load-bearing (otherwise the third repo is a dead mirror) — but the risk lives entirely in the registry/publish plumbing, not the code, so we de-risk *that* in isolation.

**Gate — do not start until ALL are true:**
- [ ] All 4 packages published on the org registry, **including `elevenlabs-convai`** (the voice work at `src/components/voice/` is untracked and not yet a package).
- [ ] Scope name locked (`@mmcbuild-ai`) — the `@caistech`/`@mmcbuild`/`@mmcbuild-ai` ambiguity from the handover addendum resolved.
- [ ] `GITHUB_PACKAGES_TOKEN` (read:packages) set on the `mmc-application` Vercel project (sensitive; prod+preview only) **and** in CI.
- [ ] **Publish-before-flip proven on a preview deploy** — a preview build successfully installs the 4 packages before any production change.

**Steps (small — facade pattern keeps the blast radius to ~3–5 sites):**
- [ ] Add the 4 `@mmcbuild-ai/*` deps to `package.json`; add `@mmcbuild-ai:registry=...` + `${GITHUB_PACKAGES_TOKEN}` to `.npmrc`.
- [ ] Flip the **facades** — `src/lib/platform-trust.ts` and `src/lib/property-services/index.ts` — to import from `@mmcbuild-ai/*` instead of `@/lib/services/*`. (Dozens of downstream consumers of the facades don't change.)
- [ ] Flip mapbox's **3 direct sites** (`components/common/address-autocomplete.tsx`, `components/projects/create-project-dialog.tsx`, `app/(dashboard)/projects/actions.ts`) — or add a `src/lib/mapbox.ts` facade and edit it once.
- [ ] `pnpm install && pnpm build` locally → green → delete `src/lib/services/*`.
- [ ] Verify on preview, then production.

**Verification:** `mmc-application` builds consuming `@mmcbuild-ai/*` with no `src/lib/services/*` left; a fresh clone + `pnpm install` succeeds with the token; the trust/audit layer (`platform-trust-middleware`) behaves identically (regression-test the `/api/estimate` `trustGate` path).

**Interim rule (until §5b lands):** the vendored copies are the source of truth and **must not be hot-patched** — any divergence from `mmc-shared` is the failure the `@caistech`-first rule exists to prevent.

---

## 6. Rollback

- `pre-repo-split` tag restores `mmc-application` instantly.
- Until DNS is cut, `mmcbuild-one.vercel.app` keeps running off the existing repo — no downtime; new domains go live only when each is verified.
- DNS rollback = re-point `mmcbuild.com.au` to the prior target; TTL-bounded.
- §5b rollback = revert the facade/dep commit; the vendored `src/lib/services/*` is restored from the same revert (kept until §5b is proven in production).

---

## 7. Sequencing (three independent workstreams — do NOT stack the risk)

| # | Workstream | Window | Notes |
|---|---|---|---|
| 1 | **Marketing split** (§5) | Mon–Tue | Urgent (failure containment). Low-risk, self-contained. **No registry dependency.** |
| 2 | **Re-externalize services** (§5b) | **Later, separate** | Gated on the 4 conditions in §5b. Re-introduces the registry dependency — keep it off the critical path and off the production window of (1) and (3). |
| 3 | **Supabase data migration** (`skyeqimwnyuuozvhubdc` → `lztzyfeivpsbqbsfzctw`) | Separate 1-hr window | `pg_dump` + restore + storage copy + Vercel env swap. Per SUPABASE_MIGRATION_PLAYBOOK — dumps gitignored, treated as PII, deleted post-verify. |

Pairing (1)'s auth-redirect re-pointing with (3)'s env swap in the **same** maintenance window minimises auth/env touches. **(2) stays on its own.**

---

## 8. Open items

**Confirmed with Karthik (2026-05-24 call, 2026-05-25):**
- ✅ **Three repos** — `mmc-marketing` + `mmc-application` + `mmc-shared` (kept separate, not folded in).
- ✅ **No network boundary** — `mmc-application` stays a single fullstack app.
- ✅ **Division** — market = brochure only; dashboard UI + auth in application (the ADR-007 one rule).

**Decided (this analysis):**
- ✅ **Services → packaged, not kept vendored** — `mmc-application` consumes `mmc-shared`'s `@mmcbuild-ai/*` packages, but as the **decoupled, gated §5b milestone** — not in the marketing-split window.

**Still open — confirm before execution:**
1. **Lead-form target** (Phase 3): HubSpot-direct (recommended) vs CORS POST to the app's `/api/leads`.
2. **DNS** at VentraIP: `mmcbuild.com.au` still resolves to Base44 until Karen signs off visual parity — who actions apex + `www` + `app`, and when.
3. **Sender domain:** keep `updates.corporateaisolutions.com`, or verify an MMC-owned Resend subdomain as part of the handover?
4. **§5b scope name** (`@mmcbuild-ai`) — lock it so the package publish + dep flip don't need a second rename.
