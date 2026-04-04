import { inngest } from "../client";
import { db } from "@/lib/supabase/db";

export const syncHubspotListing = inngest.createFunction(
  {
    id: "sync-hubspot-listing",
    name: "Sync Approved Directory Listing to HubSpot",
    retries: 2,
    onFailure: async ({ event }) => {
      console.error(
        `[HubSpot] Failed to sync listing ${event.data.event.data.listingId} after retries`
      );
    },
  },
  { event: "directory/entry.approved" },
  async ({ event, step }) => {
    const { listingId } = event.data;

    // 1. Check for HubSpot API key — no-op if not configured
    const apiKey = process.env.HUBSPOT_API_KEY;
    if (!apiKey) {
      console.warn("[HubSpot] HUBSPOT_API_KEY not configured — skipping sync");
      return { skipped: true, reason: "no_api_key" };
    }

    // 2. Load the listing
    const listing = await step.run("load-listing", async () => {
      const { data, error } = await db()
        .from("directory_listings")
        .select("*")
        .eq("id", listingId)
        .single();

      if (error || !data) {
        throw new Error(`Listing not found: ${error?.message}`);
      }

      return data as {
        id: string;
        company_name: string;
        abn: string | null;
        categories: string[];
        contact_name: string;
        contact_email: string;
        contact_phone: string | null;
        location: string | null;
        service_area: string[];
        licences_held: string | null;
        description: string | null;
        created_at: string;
      };
    });

    // 3. Create or update HubSpot Company
    const hubspotCompanyId = await step.run("create-hubspot-company", async () => {
      const properties: Record<string, string> = {
        name: listing.company_name,
        description: listing.description ?? "",
        phone: listing.contact_phone ?? "",
        mmc_categories: listing.categories.join(", "),
        mmc_service_area: listing.service_area.join(", "),
        mmc_licences: listing.licences_held ?? "",
        mmc_approval_date: new Date().toISOString().split("T")[0],
      };

      if (listing.abn) properties.mmc_abn = listing.abn;
      if (listing.location) properties.city = listing.location;

      const res = await fetch("https://api.hubapi.com/crm/v3/objects/companies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ properties }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HubSpot API error ${res.status}: ${body}`);
      }

      const data = await res.json();
      return data.id as string;
    });

    // 4. Create HubSpot Contact for the listing
    await step.run("create-hubspot-contact", async () => {
      const nameParts = listing.contact_name.split(" ");
      const firstName = nameParts[0] || listing.contact_name;
      const lastName = nameParts.slice(1).join(" ") || "";

      const properties: Record<string, string> = {
        email: listing.contact_email,
        firstname: firstName,
        lastname: lastName,
        company: listing.company_name,
      };

      if (listing.contact_phone) properties.phone = listing.contact_phone;

      const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ properties }),
      });

      // Contact may already exist — 409 is fine
      if (!res.ok && res.status !== 409) {
        const body = await res.text();
        console.warn(`[HubSpot] Contact create warning ${res.status}: ${body}`);
      }
    });

    // 5. Store HubSpot company ID back on the listing
    await step.run("update-listing-hubspot-id", async () => {
      await db()
        .from("directory_listings")
        .update({ admin_notes: `HubSpot Company ID: ${hubspotCompanyId}` })
        .eq("id", listingId);
    });

    return { success: true, listingId, hubspotCompanyId };
  }
);
