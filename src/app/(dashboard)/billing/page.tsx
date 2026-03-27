import { Suspense } from "react";
import { ModuleHero } from "@/components/shared/module-hero";
import { BillingContent } from "./billing-content";

export default function BillingPage() {
  return (
    <div className="space-y-6">
      <ModuleHero
        module="billing"
        heading={
          <>
            Manage Your{" "}
            <span className="text-emerald-400">Subscription</span>
          </>
        }
        description="View your plan, track usage, and manage billing."
      />

      <Suspense
        fallback={
          <div className="space-y-6 animate-pulse">
            <div className="h-48 bg-slate-100 rounded-2xl" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="h-64 bg-slate-100 rounded-2xl" />
              <div className="h-64 bg-slate-100 rounded-2xl" />
              <div className="h-64 bg-slate-100 rounded-2xl" />
            </div>
          </div>
        }
      >
        <BillingContent />
      </Suspense>
    </div>
  );
}
