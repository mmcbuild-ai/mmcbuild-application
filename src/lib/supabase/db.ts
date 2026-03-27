import { createAdminClient } from "./admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

/**
 * Shared admin DB helper for tables not yet in generated Supabase types.
 * Use this instead of duplicating db() in each module's actions.ts.
 * Once `supabase gen types` is re-run, this becomes unnecessary.
 */
export function db() {
  return createAdminClient() as unknown as AnyDb;
}
