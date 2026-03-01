import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { testFunction } from "@/lib/inngest/functions/test-function";
import { processPlan } from "@/lib/inngest/functions/process-plan";
import { runComplianceCheck } from "@/lib/inngest/functions/run-compliance-check";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [testFunction, processPlan, runComplianceCheck],
});
