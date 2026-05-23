import { z } from "zod";

// Public enquiry submitted from /estimate (search box or voice handoff).
export const estimateQuerySchema = z.object({
  query: z.string().trim().min(2, "Tell us what you're sourcing").max(500),
  region: z.string().trim().max(50).optional().default("NSW"),
  source: z.enum(["search", "voice"]).default("search"),
});
export type EstimateQuery = z.infer<typeof estimateQuerySchema>;

// Structured intent produced by the cheap query-parse step (or the voice agent).
// This is the boundary the LLM output must satisfy before it touches the rate lookup.
export const discoveredIntentSchema = z.object({
  category: z.string().trim().min(1).max(120),
  element: z.string().trim().max(200).optional().default(""),
  quantity: z.number().positive().optional(),
  unit: z.string().trim().max(40).optional(),
  region: z.string().trim().max(50).optional().default("NSW"),
  projectContext: z.string().trim().max(1000).optional().default(""),
});
export type DiscoveredIntent = z.infer<typeof discoveredIntentSchema>;

// One indicative line item. low/high are integer cents; the estimate primitive
// clamps these to non-negative and enforces low <= high before persisting.
export const estimateLineItemSchema = z
  .object({
    label: z.string().trim().min(1).max(200),
    lowCents: z.number().int().nonnegative(),
    highCents: z.number().int().nonnegative(),
  })
  .refine((li) => li.lowCents <= li.highCents, {
    message: "lowCents must be <= highCents",
  });
export type EstimateLineItem = z.infer<typeof estimateLineItemSchema>;

// Signup-gate claim: links the anonymous estimate to a new account.
export const claimEstimateSchema = z.object({
  token: z.string().trim().min(10).max(200),
  contactName: z.string().trim().min(1, "Name is required").max(120),
  contactPhone: z.string().trim().min(5, "Phone is required").max(40),
  consent: z
    .boolean()
    .refine((v) => v === true, { message: "Consent is required to continue" }),
});
export type ClaimEstimateInput = z.infer<typeof claimEstimateSchema>;
