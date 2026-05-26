# MMC Build — Stripe + HubSpot setup

Both live in the **application** (`mmcbuild-application`), not the marketing brochure.
All env vars below go on the **mmcbuild-application** Vercel project (Production + Preview),
never on marketing.

---

## Stripe (billing)

Per-module subscriptions, **AUD / month**, **test mode for the MVP**. The app reads one
price ID per module (`src/lib/stripe/plans.ts`).

### Env vars (mmcbuild-application)

| Var | What | Class |
|---|---|---|
| `STRIPE_SECRET_KEY` | Karen's Stripe → Developers → API keys → Secret key (`sk_test_…` for MVP) | **Sensitive** |
| `STRIPE_COMPLY_PRICE_ID` | Comply module price | plain |
| `STRIPE_BUILD_PRICE_ID` | Build module price | plain |
| `STRIPE_QUOTE_PRICE_ID` | Quote module price | plain |
| `STRIPE_DIRECT_PRICE_ID` | Direct module price | plain |
| `STRIPE_TRAIN_PRICE_ID` | Train module price | plain |
| `STRIPE_WEBHOOK_SECRET` | created post-deploy (step 3) | **Sensitive** |

*(Optional legacy bundles — only if sold: `STRIPE_BASIC_PRICE_ID`, `STRIPE_PROFESSIONAL_PRICE_ID`.)*

### Steps

1. **API key.** Use Karen's Stripe account in **test mode**. Copy the Secret key (`sk_test_…`)
   → `STRIPE_SECRET_KEY`.

2. **Products + prices.** Create the 5 module products with **monthly AUD** recurring prices,
   matching the app exactly:

   | Module | Price (AUD/mo) | Env var |
   |---|---|---|
   | Comply | 99 | `STRIPE_COMPLY_PRICE_ID` |
   | Build | 79 | `STRIPE_BUILD_PRICE_ID` |
   | Quote | 99 | `STRIPE_QUOTE_PRICE_ID` |
   | Direct | 49 | `STRIPE_DIRECT_PRICE_ID` |
   | Train | 49 | `STRIPE_TRAIN_PRICE_ID` |

   **Fastest:** run the script — it creates them idempotently and prints the env lines:
   ```bash
   STRIPE_SECRET_KEY=sk_test_xxx node scripts/setup-stripe-products.mjs
   ```
   Then paste its output into Vercel. (Re-running is safe — it reuses existing products/prices.)
   Or create them by hand in the Stripe dashboard and copy each `price_…` ID.

3. **Webhook** *(do AFTER the app is deployed — it needs the live URL).*
   Stripe → Developers → Webhooks → **Add endpoint**:
   - **URL:** `https://mmcbuild-application.vercel.app/api/webhooks/stripe`
     (→ `https://app.mmcbuild.com.au/api/webhooks/stripe` at cutover — update it then)
   - **Events — select exactly these 5** (what `src/app/api/webhooks/stripe/route.ts` handles):
     - `checkout.session.completed`
     - `invoice.paid`
     - `invoice.payment_failed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
   - After creating, reveal the **Signing secret** (`whsec_…`) → `STRIPE_WEBHOOK_SECRET`.

4. **Redeploy**, then test on `/billing`: subscribe to a module with test card
   `4242 4242 4242 4242` (any future expiry + CVC). Confirm the webhook shows **200** in Stripe
   and the module unlocks in the app.

---

## HubSpot (lead forms)

**How it works:** the marketing site POSTs each lead to the **application's** `/api/leads`, which
(1) saves it to the Supabase `leads` table (source of truth), (2) submits it to the **HubSpot
Forms API**, and (3) emails Karen via Resend. (`src/app/api/leads/route.ts`, `src/lib/hubspot/forms.ts`.)

### Config (mmcbuild-application)

The Forms submission uses **portal ID + form ID only — no API key.** The code defaults to:
- `HUBSPOT_PORTAL_ID` → `442558966`
- `HUBSPOT_CONTACT_FORM_ID` → `9ef67321-b4cb-45b5-b3c1-e9d2301e0710`

**Confirm those belong to MMC's / Karen's HubSpot.** If not, set both env vars to MMC's own
portal + a contact form with these fields: `firstname, lastname, email, phone, company, jobrole,
message, interest`.

> `HUBSPOT_API_KEY` is **not** used by the lead form — it's only for the directory CRM sync
> (`sync-hubspot-listing.ts`). Set it only if the directory sync is in use.

### Steps

1. Confirm/point the portal + form IDs at MMC's HubSpot (above).
2. **Allowed domains** (the earlier "spam notice"): add `mmcbuild.com.au` (and the marketing
   preview URL) to HubSpot's form allowed-domains so submissions aren't flagged.
3. **Test:** submit the marketing lead form, then confirm — a row in Supabase `leads`, a contact
   in HubSpot, and Karen's email alert all land.

### CORS note (fixed 2026-05-27)

`/api/leads` only accepts cross-origin POSTs from an allowlist. The marketing prod alias is
`mmcbuild-marketing-theta.vercel.app`, which the original allowlist didn't match — so lead-form
POSTs from the marketing **test URL** were CORS-blocked (production `mmcbuild.com.au` was always
fine). Fixed by adding that host to `ALLOWED_ORIGINS` in `src/app/api/leads/route.ts`. If the
marketing project is renamed/re-aliased later, update that allowlist accordingly.

---

*Reference: `src/lib/stripe/plans.ts`, `src/app/api/webhooks/stripe/route.ts`,
`src/app/api/leads/route.ts`, `src/lib/hubspot/forms.ts`. Script: `scripts/setup-stripe-products.mjs`.*
