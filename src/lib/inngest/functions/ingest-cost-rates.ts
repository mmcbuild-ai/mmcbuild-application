/**
 * Inngest function: ingest-cost-rates
 * Pulls rates from an external source (API/CSV) and upserts into cost_reference_rates.
 */

import { inngest } from "../client";
import { db } from "@/lib/supabase/db";
import { getAdapter } from "@/lib/cost/rate-adapters";

export const ingestCostRates = inngest.createFunction(
  {
    id: "ingest-cost-rates",
    name: "Ingest Cost Rates",
    retries: 2,
  },
  { event: "cost/rates.ingest-requested" },
  async ({ event, step }) => {
    const { sourceId } = event.data;

    // 1. Load the rate source config
    const source = await step.run("load-source", async () => {
      const { data, error } = await db()
        .from("cost_rate_sources")
        .select("id, name, source_type, config, is_active")
        .eq("id", sourceId)
        .single();

      if (error || !data) {
        throw new Error(`Rate source not found: ${error?.message}`);
      }

      if (!data.is_active) {
        throw new Error(`Rate source "${data.name}" is disabled`);
      }

      return data as {
        id: string;
        name: string;
        source_type: string;
        config: Record<string, unknown>;
        is_active: boolean;
      };
    });

    // 2. Fetch rates via the appropriate adapter
    const rates = await step.run("fetch-rates", async () => {
      const adapter = getAdapter(source.source_type);
      return adapter.fetch(source.config);
    });

    if (rates.length === 0) {
      // Update sync time even if no rates fetched
      await step.run("update-sync-time-empty", async () => {
        await db()
          .from("cost_rate_sources")
          .update({ last_synced_at: new Date().toISOString() })
          .eq("id", source.id);
      });
      return { sourceId: source.id, sourceName: source.name, upserted: 0 };
    }

    // 3. Upsert rates into cost_reference_rates
    const upserted = await step.run("upsert-rates", async () => {
      let count = 0;

      for (const rate of rates) {
        // Check if rate already exists for this source + category + element + state
        const { data: existing } = await db()
          .from("cost_reference_rates")
          .select("id")
          .eq("category", rate.category)
          .eq("element", rate.element)
          .eq("state", rate.state)
          .eq("source_id", source.id)
          .limit(1)
          .maybeSingle();

        if (existing) {
          // Update existing rate
          await db()
            .from("cost_reference_rates")
            .update({
              base_rate: rate.rate,
              unit: rate.unit,
              source_detail: rate.source_detail ?? null,
              effective_date: new Date().toISOString().split("T")[0],
            })
            .eq("id", existing.id);
        } else {
          // Insert new rate
          await db()
            .from("cost_reference_rates")
            .insert({
              category: rate.category,
              element: rate.element,
              unit: rate.unit,
              base_rate: rate.rate,
              state: rate.state,
              year: new Date().getFullYear(),
              source: source.name,
              source_id: source.id,
              source_detail: rate.source_detail ?? null,
              effective_date: new Date().toISOString().split("T")[0],
            } as never);
        }
        count++;
      }

      return count;
    });

    // 4. Update sync timestamp
    await step.run("update-sync-time", async () => {
      await db()
        .from("cost_rate_sources")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("id", source.id);
    });

    return { sourceId: source.id, sourceName: source.name, upserted };
  }
);
