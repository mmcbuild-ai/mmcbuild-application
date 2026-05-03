import { Suspense } from "react";
import { ExplainerVideo } from "@/components/shared/explainer-video";
import { BillingContent } from "./billing-content";

export default function BillingPage() {
  return (
    <div className="space-y-6">
      <ExplainerVideo module="billing" videoUrl="/videos/billing-explainer.mp4" />

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
