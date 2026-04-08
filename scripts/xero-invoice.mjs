#!/usr/bin/env node
/**
 * GBTA — Xero Invoice Creator
 *
 * Persistent CLI tool for creating Xero invoices for any client.
 * Uses OAuth 2.0 with automatic token refresh. No SDK dependency —
 * uses native fetch (Node 18+).
 *
 * ── Setup (one-time) ──────────────────────────────────────────────
 *
 * 1. Create a Xero app at https://developer.xero.com/app/manage
 *    - App type: "Web app"
 *    - Redirect URI: http://localhost:3891/callback
 *    - Copy Client ID and Client Secret
 *
 * 2. Add to your .env.local:
 *    XERO_CLIENT_ID=your_client_id
 *    XERO_CLIENT_SECRET=your_client_secret
 *    XERO_REDIRECT_URI=http://localhost:3891/callback
 *
 * ── Usage ─────────────────────────────────────────────────────────
 *
 * First run (authorize):
 *   node scripts/xero-invoice.mjs auth
 *
 * Create invoice:
 *   node scripts/xero-invoice.mjs invoice \
 *     --contact "MMC Build Pty Ltd" \
 *     --email "karen.engel@mmcbuild.com.au" \
 *     --ref "GBTA-MMC-2026-001-A1" \
 *     --due-days 14 \
 *     --items '[{"desc":"Progress Payment 1 — Stages 0+1","qty":1,"amount":7480,"tax":"OUTPUT","code":"200"}]' \
 *     --status AUTHORISED
 *
 * List contacts:
 *   node scripts/xero-invoice.mjs contacts
 *
 * List invoices:
 *   node scripts/xero-invoice.mjs invoices --contact "MMC Build Pty Ltd"
 *
 * Check token status:
 *   node scripts/xero-invoice.mjs status
 *
 * Re-authorize (if tokens expired after 60 days):
 *   node scripts/xero-invoice.mjs auth
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { createServer } from "http";
import { URL } from "url";
import { randomBytes } from "crypto";
import { exec } from "child_process";

// ── Config ───────────────────────────────────────────────────────────────

const CONFIG_DIR = join(
  process.env.HOME || process.env.USERPROFILE,
  ".xero"
);
const TOKEN_FILE = join(CONFIG_DIR, "tokens.json");
const TENANT_FILE = join(CONFIG_DIR, "tenants.json");

// Load .env.local
const envPath = join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  readFileSync(envPath, "utf8")
    .split("\n")
    .forEach((line) => {
      const [key, ...rest] = line.split("=");
      if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
    });
}

const CLIENT_ID = process.env.XERO_CLIENT_ID;
const CLIENT_SECRET = process.env.XERO_CLIENT_SECRET;
const REDIRECT_URI = process.env.XERO_REDIRECT_URI || "http://localhost:3891/callback";
// Post-March 2026 apps use granular scopes
// accounting.transactions → split into accounting.invoices + accounting.payments
// accounting.contacts → unchanged
const SCOPES = "accounting.invoices accounting.contacts offline_access";

// ── Token Management ─────────────────────────────────────────────────────

function ensureConfigDir() {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
}

function loadTokens() {
  if (!existsSync(TOKEN_FILE)) return null;
  return JSON.parse(readFileSync(TOKEN_FILE, "utf8"));
}

function saveTokens(tokenSet) {
  ensureConfigDir();
  tokenSet.expires_at = Date.now() + tokenSet.expires_in * 1000;
  tokenSet.saved_at = new Date().toISOString();
  writeFileSync(TOKEN_FILE, JSON.stringify(tokenSet, null, 2));
}

function loadTenants() {
  if (!existsSync(TENANT_FILE)) return null;
  return JSON.parse(readFileSync(TENANT_FILE, "utf8"));
}

function saveTenants(tenants) {
  ensureConfigDir();
  writeFileSync(TENANT_FILE, JSON.stringify(tenants, null, 2));
}

async function exchangeCode(code) {
  const res = await fetch("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${err}`);
  }
  return res.json();
}

async function refreshTokens(refreshToken) {
  const res = await fetch("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${err}`);
  }
  return res.json();
}

async function getValidToken() {
  let tokens = loadTokens();
  if (!tokens) {
    console.error("\n❌ No tokens found. Run: node scripts/xero-invoice.mjs auth\n");
    process.exit(1);
  }

  // Refresh if expiring within 2 minutes
  if (Date.now() > tokens.expires_at - 120_000) {
    console.log("  ↻ Refreshing access token...");
    try {
      tokens = await refreshTokens(tokens.refresh_token);
      saveTokens(tokens);
      console.log("  ✓ Token refreshed");
    } catch (err) {
      console.error(`\n❌ ${err.message}`);
      console.error("  Tokens may have expired (60-day limit). Re-run: node scripts/xero-invoice.mjs auth\n");
      process.exit(1);
    }
  }

  return tokens.access_token;
}

async function getTenantId() {
  let tenants = loadTenants();
  if (tenants?.length) return tenants[0].tenantId;

  // Fetch from API
  const token = await getValidToken();
  const res = await fetch("https://api.xero.com/connections", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to get tenants: ${res.status}`);
  tenants = await res.json();
  saveTenants(tenants);
  if (!tenants.length) throw new Error("No Xero organisations connected");
  console.log(`  ✓ Using org: ${tenants[0].tenantName}`);
  return tenants[0].tenantId;
}

// ── Xero API Helpers ─────────────────────────────────────────────────────

async function xeroApi(method, path, body = null) {
  const token = await getValidToken();
  const tenantId = await getTenantId();
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
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Xero API ${method} ${path} → ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

// ── Commands ─────────────────────────────────────────────────────────────

async function cmdAuth() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error("\n❌ Missing XERO_CLIENT_ID and/or XERO_CLIENT_SECRET in .env.local\n");
    console.error("  1. Create a Xero app at https://developer.xero.com/app/manage");
    console.error("  2. Add to .env.local:");
    console.error("     XERO_CLIENT_ID=your_client_id");
    console.error("     XERO_CLIENT_SECRET=your_client_secret");
    console.error("     XERO_REDIRECT_URI=http://localhost:3891/callback\n");
    process.exit(1);
  }

  const state = randomBytes(16).toString("hex");
  const authUrl = new URL("https://login.xero.com/identity/connect/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("state", state);

  console.log("\n🔐 Xero OAuth 2.0 Authorization\n");
  console.log("  Open this URL in your browser:\n");
  console.log(`  ${authUrl.toString()}\n`);
  console.log("  Waiting for callback on http://localhost:3891 ...\n");

  // Start local server to receive callback
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url, "http://localhost:3891");
      if (url.pathname !== "/callback") {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const code = url.searchParams.get("code");
      const returnedState = url.searchParams.get("state");

      if (returnedState !== state) {
        res.writeHead(400);
        res.end("State mismatch — possible CSRF. Try again.");
        return;
      }

      if (!code) {
        res.writeHead(400);
        res.end("No authorization code received.");
        return;
      }

      try {
        console.log("  ✓ Authorization code received");
        const tokens = await exchangeCode(code);
        saveTokens(tokens);
        console.log("  ✓ Tokens saved to ~/.xero/tokens.json");

        // Fetch and save tenants
        const tenantRes = await fetch("https://api.xero.com/connections", {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        const tenants = await tenantRes.json();
        saveTenants(tenants);
        console.log(`  ✓ Connected org: ${tenants[0]?.tenantName || "unknown"}`);

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <html><body style="font-family:system-ui;text-align:center;padding:60px">
            <h1>✅ Xero Connected</h1>
            <p>You can close this tab and return to the terminal.</p>
            <p>Organisation: <strong>${tenants[0]?.tenantName || "unknown"}</strong></p>
          </body></html>
        `);
      } catch (err) {
        console.error(`  ✗ ${err.message}`);
        res.writeHead(500);
        res.end(`Error: ${err.message}`);
      }

      server.close();
      resolve();
    });

    server.listen(3891, () => {
      // Try to open browser automatically
      const cmd =
        process.platform === "win32" ? "start" :
        process.platform === "darwin" ? "open" : "xdg-open";
      exec(`${cmd} "${authUrl.toString()}"`);
    });
  });
}

async function cmdStatus() {
  const tokens = loadTokens();
  if (!tokens) {
    console.log("\n  ❌ Not authorized. Run: node scripts/xero-invoice.mjs auth\n");
    return;
  }

  const tenants = loadTenants();
  const expiresIn = Math.round((tokens.expires_at - Date.now()) / 1000);
  const refreshAge = Math.round((Date.now() - new Date(tokens.saved_at).getTime()) / 86400000);

  console.log("\n  Xero Connection Status");
  console.log("  ─────────────────────");
  console.log(`  Organisation:    ${tenants?.[0]?.tenantName || "unknown"}`);
  console.log(`  Access token:    ${expiresIn > 0 ? `valid (${expiresIn}s remaining)` : "expired"}`);
  console.log(`  Refresh token:   ${refreshAge < 60 ? `valid (${60 - refreshAge} days remaining)` : "⚠️ may be expired"}`);
  console.log(`  Last refreshed:  ${tokens.saved_at}`);
  console.log(`  Token file:      ${TOKEN_FILE}\n`);
}

async function cmdContacts(search) {
  const where = search ? `?where=Name.Contains("${search}")` : "?page=1";
  const data = await xeroApi("GET", `/Contacts${where}`);
  console.log("\n  Contacts:");
  for (const c of data.Contacts || []) {
    console.log(`  • ${c.Name} (${c.ContactID}) ${c.EmailAddress || ""}`);
  }
  console.log(`\n  Total: ${data.Contacts?.length || 0}\n`);
}

async function findOrCreateContact(name, email) {
  // Search for existing contact
  const search = await xeroApi("GET", `/Contacts?where=Name=="${encodeURIComponent(name)}"`);
  if (search.Contacts?.length) {
    const existing = search.Contacts[0];
    console.log(`  ✓ Found existing contact: ${existing.Name} (${existing.ContactID})`);
    return existing.ContactID;
  }

  // Create new contact
  const contactData = { Name: name };
  if (email) contactData.EmailAddress = email;
  const result = await xeroApi("POST", "/Contacts", { Contacts: [contactData] });
  const newContact = result.Contacts?.[0];
  if (!newContact?.ContactID) throw new Error("Failed to create contact");
  console.log(`  ✓ Created new contact: ${newContact.Name} (${newContact.ContactID})`);
  return newContact.ContactID;
}

async function checkDuplicate(invoiceNumber) {
  if (!invoiceNumber) return null;
  try {
    const data = await xeroApi("GET", `/Invoices?InvoiceNumbers=${encodeURIComponent(invoiceNumber)}`);
    const existing = data.Invoices?.find((i) => i.InvoiceNumber === invoiceNumber);
    if (existing) return existing;
  } catch {
    // Endpoint may not support filter — fall back to broad search
    const data = await xeroApi("GET", `/Invoices?where=InvoiceNumber=="${encodeURIComponent(invoiceNumber)}"`);
    if (data.Invoices?.length) return data.Invoices[0];
  }
  return null;
}

async function cmdInvoice(args) {
  const contact = args["--contact"];
  const email = args["--email"];
  const ref = args["--ref"] || "";
  const dueDays = parseInt(args["--due-days"] || "14", 10);
  const itemsJson = args["--items"];
  const status = args["--status"] || "DRAFT";
  const invoiceNumber = args["--number"] || undefined;

  if (!contact || !itemsJson) {
    console.error("\n❌ Required: --contact and --items\n");
    console.error("  Example:");
    console.error('  node scripts/xero-invoice.mjs invoice \\');
    console.error('    --contact "MMC Build Pty Ltd" \\');
    console.error('    --email "karen.engel@mmcbuild.com.au" \\');
    console.error('    --ref "GBTA-MMC-2026-001-A1" \\');
    console.error('    --due-days 14 \\');
    console.error("    --items '[{\"desc\":\"Stage 0+1\",\"qty\":1,\"amount\":7480,\"code\":\"200\"}]' \\");
    console.error('    --status AUTHORISED\n');
    process.exit(1);
  }

  let items;
  try {
    items = JSON.parse(itemsJson);
  } catch {
    console.error("\n❌ --items must be valid JSON\n");
    process.exit(1);
  }

  console.log(`\n  Creating invoice for: ${contact}`);

  // Duplicate check
  if (invoiceNumber) {
    const dup = await checkDuplicate(invoiceNumber);
    if (dup) {
      console.log(`  ⚠️  SKIPPED — Invoice ${invoiceNumber} already exists:`);
      console.log(`    Status: ${dup.Status} | Total: $${dup.Total} | Due: ${dup.DueDate}`);
      console.log(`    ID: ${dup.InvoiceID}\n`);
      return dup;
    }
  }

  const contactId = await findOrCreateContact(contact, email);

  const today = new Date().toISOString().split("T")[0];
  const dueDate = new Date(Date.now() + dueDays * 86400000).toISOString().split("T")[0];

  const invoice = {
    Type: "ACCREC",
    Contact: { ContactID: contactId },
    Date: today,
    DueDate: dueDate,
    Reference: ref,
    Status: status,
    LineAmountTypes: "Exclusive",
    LineItems: items.map((item) => ({
      Description: item.desc,
      Quantity: item.qty || 1,
      UnitAmount: item.amount,
      AccountCode: item.code || "200",
      TaxType: item.tax || "OUTPUT",
    })),
  };

  if (invoiceNumber) invoice.InvoiceNumber = invoiceNumber;

  const result = await xeroApi("POST", "/Invoices", { Invoices: [invoice] });
  const created = result.Invoices?.[0];

  if (!created?.InvoiceID) {
    console.error("  ✗ Failed to create invoice");
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }

  console.log(`  ✓ Invoice created!`);
  console.log(`    Number:   ${created.InvoiceNumber}`);
  console.log(`    Status:   ${created.Status}`);
  console.log(`    Total:    $${created.Total} (incl. GST)`);
  console.log(`    Due:      ${created.DueDate}`);
  console.log(`    ID:       ${created.InvoiceID}`);
  console.log(`    Ref:      ${ref}\n`);

  return created;
}

async function cmdListInvoices(args) {
  const contact = args["--contact"];
  let path = "/Invoices?order=Date DESC&page=1";
  if (contact) {
    path += `&where=Contact.Name=="${encodeURIComponent(contact)}"`;
  }
  const data = await xeroApi("GET", path);
  console.log("\n  Invoices:");
  for (const inv of data.Invoices || []) {
    const paid = inv.AmountPaid > 0 ? ` (paid: $${inv.AmountPaid})` : "";
    console.log(`  • ${inv.InvoiceNumber || "DRAFT"} | ${inv.Contact?.Name} | $${inv.Total} | ${inv.Status} | Due: ${inv.DueDate}${paid}`);
  }
  console.log(`\n  Total: ${data.Invoices?.length || 0}\n`);
}

// ── Batch invoice helper for MMC Build ───────────────────────────────────

async function cmdMmcInvoices() {
  console.log("\n  📄 Creating MMC Build progress invoices...\n");

  const contact = "MMC Build Pty Ltd";
  const email = "karen.engel@mmcbuild.com.au";
  const ref = "GBTA-MMC-2026-001-A1";

  // Deposit is INV-0008 (already in Xero, $13,277 incl. GST — overdue)
  // Progress invoices follow Xero's sequential numbering
  const invoices = [
    {
      number: "INV-0009",
      desc: "Progress Payment 1 — Stages 0+1: Foundation + NCC Compliance Engine (Ref: GBTA-MMC-2026-001-A1)",
      amount: 7480,
    },
    {
      number: "INV-0010",
      desc: "Progress Payment 2 — Stages 2+3: Design Optimisation + Cost Estimation (Ref: GBTA-MMC-2026-001-A1)",
      amount: 21250,
    },
    {
      number: "INV-0011",
      desc: "Progress Payment 3 — Stages 4+5: Trade Directory + Training Modules (Ref: GBTA-MMC-2026-001-A1)",
      amount: 8500,
    },
  ];

  // Look up contact once
  const contactId = await findOrCreateContact(contact, email);

  for (const inv of invoices) {
    console.log(`  ── ${inv.number} ──`);

    // Duplicate check
    const dup = await checkDuplicate(inv.number);
    if (dup) {
      console.log(`  ⚠️  SKIPPED — already exists: ${dup.Status} | $${dup.Total} | Due: ${dup.DueDate}`);
      continue;
    }

    const today = new Date().toISOString().split("T")[0];
    const dueDate = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];

    const invoice = {
      Type: "ACCREC",
      Contact: { ContactID: contactId },
      Date: today,
      DueDate: dueDate,
      Reference: ref,
      InvoiceNumber: inv.number,
      Status: "AUTHORISED",
      LineAmountTypes: "Exclusive",
      LineItems: [
        {
          Description: inv.desc,
          Quantity: 1,
          UnitAmount: inv.amount,
          AccountCode: "200",
          TaxType: "OUTPUT",
        },
      ],
    };

    const result = await xeroApi("POST", "/Invoices", { Invoices: [invoice] });
    const created = result.Invoices?.[0];
    if (created?.InvoiceID) {
      console.log(`  ✓ ${created.InvoiceNumber}: $${created.Total} incl. GST — Due: ${created.DueDate}`);
    } else {
      console.log(`  ✗ Failed: ${inv.number}`);
    }
  }

  console.log("\n  ✅ All MMC Build invoices created.\n");
}

// ── CLI Router ───────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i];
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      args[key] = val;
    }
  }
  return args;
}

const command = process.argv[2];
const args = parseArgs(process.argv.slice(3));

switch (command) {
  case "auth":
    await cmdAuth();
    break;

  case "status":
    await cmdStatus();
    break;

  case "contacts":
    await cmdContacts(args["--search"]);
    break;

  case "invoice":
    await cmdInvoice(args);
    break;

  case "invoices":
    await cmdListInvoices(args);
    break;

  case "mmc-invoices":
    await cmdMmcInvoices();
    break;

  default:
    console.log(`
  GBTA — Xero Invoice Creator
  ────────────────────────────

  Commands:
    auth                    Authorize with Xero (opens browser)
    status                  Check token/connection status
    contacts [--search X]   List or search contacts
    invoice [options]       Create a single invoice
    invoices [--contact X]  List invoices
    mmc-invoices            Create all 3 MMC Build progress invoices

  Invoice options:
    --contact   Contact/company name (required)
    --email     Contact email (used if creating new contact)
    --ref       Invoice reference
    --number    Custom invoice number
    --due-days  Days until due (default: 14)
    --items     JSON array of line items (required)
    --status    DRAFT or AUTHORISED (default: DRAFT)

  Line item format:
    [{"desc":"Description","qty":1,"amount":1000,"code":"200","tax":"OUTPUT"}]

  Examples:
    node scripts/xero-invoice.mjs auth
    node scripts/xero-invoice.mjs invoice --contact "Acme Corp" --items '[{"desc":"Consulting","qty":1,"amount":5000,"code":"200"}]'
    node scripts/xero-invoice.mjs mmc-invoices
`);
}
