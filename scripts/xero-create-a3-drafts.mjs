#!/usr/bin/env node
/**
 * Create the 6 DRAFT invoices for MMC Build payment schedule A3.
 * Part A: $6,825.50 incl. GST × 6 monthly instalments.
 * Part B (Final Payment $12,155 on Stage 7 acceptance) is NOT created here.
 *
 * Idempotent by reference + description match — re-running will skip existing drafts.
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

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

const HOME = process.env.HOME || process.env.USERPROFILE;
const TOKEN_FILE = join(HOME, ".xero", "tokens.json");
const TENANT_FILE = join(HOME, ".xero", "tenants.json");

function loadTokens() { return existsSync(TOKEN_FILE) ? JSON.parse(readFileSync(TOKEN_FILE, "utf8")) : null; }
function saveTokens(t) { t.expires_at = Date.now() + t.expires_in * 1000; t.saved_at = new Date().toISOString(); writeFileSync(TOKEN_FILE, JSON.stringify(t, null, 2)); }
function loadTenants() { return existsSync(TENANT_FILE) ? JSON.parse(readFileSync(TENANT_FILE, "utf8")) : null; }

async function refreshTokens(refreshToken) {
  const res = await fetch("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function getToken() {
  let tokens = loadTokens();
  if (!tokens) throw new Error("No tokens — run: node scripts/xero-invoice.mjs auth");
  if (Date.now() > tokens.expires_at - 120_000) {
    console.log("  ↻ Refreshing access token...");
    tokens = await refreshTokens(tokens.refresh_token);
    saveTokens(tokens);
    console.log("  ✓ Token refreshed");
  }
  return tokens.access_token;
}

async function xero(method, path, body = null) {
  const token = await getToken();
  const tenants = loadTenants();
  const tenantId = tenants?.[0]?.tenantId;
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Xero-tenant-id": tenantId,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`https://api.xero.com/api.xro/2.0${path}`, opts);
  const txt = await res.text();
  if (!res.ok) throw new Error(`Xero ${method} ${path} → ${res.status}: ${txt}`);
  return txt ? JSON.parse(txt) : {};
}

// ─── Plan ────────────────────────────────────────────────────────
const CONTACT_NAME = "MMC Build Pty Ltd";
const CONTACT_EMAIL = "karen.engel@mmcbuild.com.au";
const REFERENCE = "GBTA-MMC-2026-001-A3";
const AMENDMENT_DATE = "24 April 2026";

// Each instalment: ex-GST $6,205.00 + 10% GST = $6,825.50 incl.
const EX_GST = 6205.00;

const INSTALMENTS = [
  { n: 1, dueDate: "2026-04-30", issueDate: "2026-04-24" },
  { n: 2, dueDate: "2026-05-31", issueDate: "2026-05-17" },
  { n: 3, dueDate: "2026-06-30", issueDate: "2026-06-16" },
  { n: 4, dueDate: "2026-07-31", issueDate: "2026-07-17" },
  { n: 5, dueDate: "2026-08-31", issueDate: "2026-08-17" },
  { n: 6, dueDate: "2026-09-30", issueDate: "2026-09-16" },
];

// ─── Execute ─────────────────────────────────────────────────────
async function main() {
  console.log(`\n  📄 Creating 6 DRAFT invoices for ${CONTACT_NAME}\n  Reference: ${REFERENCE}\n  Amount each: $6,825.50 incl. GST\n`);

  // Verify organisation
  const tenants = loadTenants();
  console.log(`  Xero org: ${tenants?.[0]?.tenantName}\n`);

  // Find contact
  const search = await xero("GET", `/Contacts?where=${encodeURIComponent(`Name=="${CONTACT_NAME}"`)}`);
  const contact = search.Contacts?.[0];
  if (!contact) throw new Error(`Contact "${CONTACT_NAME}" not found in Xero`);
  const contactId = contact.ContactID;
  console.log(`  ✓ Contact: ${contact.Name} (${contactId})\n`);

  // Check for existing A3 invoices to avoid duplicates
  const existing = await xero("GET", `/Invoices?where=${encodeURIComponent(`Reference=="${REFERENCE}"`)}`);
  const existingByN = new Map();
  for (const inv of (existing.Invoices || [])) {
    // Extract instalment number from description if present
    const desc = inv.LineItems?.[0]?.Description || "";
    const match = desc.match(/Instalment (\d+) of 6/);
    if (match) existingByN.set(parseInt(match[1], 10), inv);
  }

  const created = [];
  for (const inst of INSTALMENTS) {
    if (existingByN.has(inst.n)) {
      const dup = existingByN.get(inst.n);
      console.log(`  ⚠️  Instalment ${inst.n}/6 — already exists: ${dup.InvoiceNumber || "DRAFT"} | $${dup.Total} | ${dup.Status}`);
      continue;
    }

    const description = `MMC Build MVP — Progress Payment Instalment ${inst.n} of 6 — Stages 0–5 delivered per Payment Schedule Amendment A3 (GBTA-MMC-2026-001-A3, ${AMENDMENT_DATE})`;

    const invoice = {
      Type: "ACCREC",
      Contact: { ContactID: contactId },
      Date: inst.issueDate,
      DueDate: inst.dueDate,
      Reference: REFERENCE,
      Status: "DRAFT",
      LineAmountTypes: "Exclusive",
      LineItems: [{
        Description: description,
        Quantity: 1,
        UnitAmount: EX_GST,
        AccountCode: "200",
        TaxType: "OUTPUT",
      }],
    };

    const result = await xero("POST", "/Invoices", { Invoices: [invoice] });
    const inv = result.Invoices?.[0];
    if (!inv?.InvoiceID) {
      console.log(`  ✗ Instalment ${inst.n}/6 — failed`);
      continue;
    }
    console.log(`  ✓ Instalment ${inst.n}/6 — ${inv.InvoiceNumber || "DRAFT"} | $${inv.Total} incl. GST | issue ${inst.issueDate} | due ${inst.dueDate} | id=${inv.InvoiceID}`);
    created.push({ n: inst.n, ...inst, xero: inv });
  }

  console.log(`\n  ✅ Done — ${created.length} drafts created.\n`);

  if (created.length > 0) {
    const first = created[0];
    console.log(`  Next step: approve + send Instalment 1 of 6 today`);
    console.log(`  Open in Xero: https://go.xero.com/app/!${tenants[0].tenantId}/invoicing/edit/${first.xero.InvoiceID}`);
    console.log(`  (The permalink may redirect via Xero's org picker on first use)\n`);
  }
}

main().catch(e => { console.error("✗ " + e.message); process.exit(1); });
