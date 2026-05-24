# MMC Build Handover — Addendum

**Date:** 2026-05-24
**Updates:** `KARTHIK_HANDOVER_2026-05-23.md` (read that for the step detail; this corrects the sequence and records what actually happened)
**Audience:** Karthik Rao (cc Karen)

---

## Why this addendum exists

The handover progressed on 2026-05-23/24 but diverged from the original plan in three ways that matter. This records the actual state and the corrected operating model so we're aligned for the call.

## What actually happened (vs the 2026-05-23 plan)

1. **Repos were re-created, not transferred.** Instead of `gh repo transfer`, fresh repos were created at `mmcbuild-ai/mmc-market` and `mmcbuild-ai/mmc-shared` and pushed, then `dennissolver` was invited as collaborator (both invites accepted). The originals still live on `dennissolver`. Net effect is the same ownership outcome — just noting the redirect from the old URLs does **not** exist, so both copies are live and independent.

2. **The dep-swap ran before the packages were published — out of order.** The original plan was Step 3 (publish the `@mmcbuild` packages) **then** Step 4 (swap the app's deps). On the org repo, Step 4 landed first: commit `64180ad` renamed `@caistech/* → @mmcbuild-ai/*`, but the `@mmcbuild-ai/*` packages are **not yet published** to the org registry. So `mmcbuild-ai/mmc-market`'s `pnpm install` 404s and the org build can't complete yet. Two related details:
   - The rename covered **3 of 4** packages — `@caistech/elevenlabs-convai` was missed, so the org repo is currently mixed-scope.
   - Versions were bumped (`mapbox 0.1.2→0.2.0`, `platform-trust-middleware 0.3.1→0.4.0`); the published packages must match.

3. **Scope name isn't agreed.** The 2026-05-23 doc uses `@mmcbuild`; the org commits use `@mmcbuild-ai`. Pick one (recommend `@mmcbuild-ai` — it matches the org slug and the commits already made).

**Unaffected / healthy:** Production `mmcbuild-one.vercel.app` still deploys from `dennissolver/mmc-market` on `@caistech/*` and is green. `mmc-shared` is byte-identical across all three copies (`2445d88`). No downtime.

## Corrected operating model (going forward)

The `dennissolver` side is the **dev source of truth**; the `mmcbuild-ai` side is the **handover mirror** that receives tested work. Symmetric for both repos:

| | Dev source (Dennis) | Handover mirror (MMC Build) |
|---|---|---|
| App | `dennissolver/mmc-market` | `mmcbuild-ai/mmc-market` |
| Shared | `dennissolver/mmc-shared` | `mmcbuild-ai/mmc-shared` |

- Dennis develops in his working copies and pushes across with **`scripts/sync-handover.sh`** — a lossless sync that fetches the mirror, **rebases local work on top of anything Karthik committed** (nothing dropped), then pushes. It **never force-pushes** and stops for human resolution on a true conflict.
- **Division of labour:** Dennis pushes application code; Karthik holds infra/deploy config — so we don't collide on the mirror's `main`.

## Recommended decision for the call: collapse to one canonical repo now

The recurring "the mirror is N commits ahead" friction only exists because **two repos are both being written**. Cleaner: make **`mmcbuild-ai/mmc-market` the single canonical repo now** — both of us fetch-rebase-push it (standard git collaboration) — and demote `dennissolver/mmc-market` to a **deploy-only mirror** Dennis alone pushes, until Vercel Pro lets the production deploy move onto the org repo. One shared write-target removes the whole class of problem.

## One-time reconciliation (needs agreement — do not do unilaterally)

`mmcbuild-ai/mmc-market` `main` currently sits 3 commits ahead of the last real app commit (`e129616`): the premature rename + lockfile regen + deploy-trigger. To get a clean shared base, reset org `main` back to `e129616` (drops those 3) so it matches the working `@caistech` state, **then** do the scope migration properly (below). This is a force-push to the org repo — Karthik's call, on the line together.

## Corrected sequence for the scope cutover (the proper Step 3 → Step 4 order)

Do this as a single deliberate milestone, paired with the backend migration window (Mon/Tue):

1. Agree scope name (`@mmcbuild-ai`).
2. **Publish all 4 packages** under the `mmcbuild-ai` org registry — `mapbox`, `platform-trust-middleware`, `property-services-sdk`, **and `elevenlabs-convai`** — at agreed versions. (This is the missed Step 3.)
3. Flip the app's deps `@caistech → @mmcbuild-ai`, update `.npmrc`, regen lockfile, verify the build **locally** before pushing.
4. Karen completes Vercel Pro; stand up the Vercel project on `mmcbuild-ai/mmc-market` with `GITHUB_PACKAGES_TOKEN` that can read the org packages.
5. Cut production deploy over to `mmcbuild-ai/mmc-market`; retire `dennissolver/mmc-market` to backup.
6. Backend application migration in the same window.

## Decisions to lock on the 8pm call

1. Scope name: **`@mmcbuild-ai`** (recommended) vs `@mmcbuild`.
2. Canonical-now (`mmcbuild-ai` single source, `dennissolver` deploy-only) — yes/no.
3. The reconciliation force-push (reset org `main` to `e129616`) — who/when.
4. Scope cutover + backend migration window = Mon/Tue — confirm.
5. Vercel Pro (~$30 AUD) — Karen to action.
