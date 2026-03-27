"use client";

import Link from "next/link";
import {
  ShieldCheck,
  Hammer,
  Calculator,
  Users,
  GraduationCap,
  Lock,
  Check,
  ArrowRight,
  Sparkles,
  Clock,
} from "lucide-react";
import { MODULES, type ModuleId } from "@/lib/stripe/plans";
import type { SubscriptionStatus } from "@/lib/stripe/subscription";

const MODULE_ICONS: Record<ModuleId, typeof ShieldCheck> = {
  comply: ShieldCheck,
  build: Hammer,
  quote: Calculator,
  direct: Users,
  train: GraduationCap,
};

const MODULE_GRADIENTS: Record<ModuleId, string> = {
  comply: "from-blue-500 to-blue-600",
  build: "from-teal-500 to-teal-600",
  quote: "from-violet-500 to-violet-600",
  direct: "from-amber-500 to-amber-600",
  train: "from-indigo-500 to-indigo-600",
};

const MODULE_BG_ACTIVE: Record<ModuleId, string> = {
  comply: "border-blue-200 bg-blue-50/50",
  build: "border-teal-200 bg-teal-50/50",
  quote: "border-violet-200 bg-violet-50/50",
  direct: "border-amber-200 bg-amber-50/50",
  train: "border-indigo-200 bg-indigo-50/50",
};

export function DashboardModules({ status }: { status: SubscriptionStatus }) {
  const isTrial = status.tier === "trial";
  const isExpired = status.tier === "expired";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Your MMC Build modules and subscription status
        </p>
      </div>

      {/* Trial / Status Banner */}
      {isTrial && status.daysRemaining !== null && (
        <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-blue-100 p-2">
                <Sparkles className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-blue-900">
                  Free Trial — All Modules Unlocked
                </h3>
                <p className="text-sm text-blue-700 mt-1">
                  {status.daysRemaining} days remaining &middot;{" "}
                  {status.usageCount} of {status.usageLimit} compliance runs
                  used
                </p>
                <p className="text-xs text-blue-600 mt-2">
                  After your trial, subscribe to individual modules to keep
                  access. Everyone keeps MMC Comply as the base module.
                </p>
              </div>
            </div>
            <Link
              href="/billing"
              className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              View Plans
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}

      {isExpired && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-red-100 p-2">
                <Clock className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-red-900">Trial Expired</h3>
                <p className="text-sm text-red-700 mt-1">
                  Subscribe to modules to continue using MMC Build. Start with
                  Comply and add more as you need them.
                </p>
              </div>
            </div>
            <Link
              href="/billing"
              className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
            >
              Subscribe Now
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Module Grid */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {(Object.keys(MODULES) as ModuleId[]).map((moduleId) => {
          const mod = MODULES[moduleId];
          const Icon = MODULE_ICONS[moduleId];
          const isActive = status.activeModules.includes(moduleId);
          const gradient = MODULE_GRADIENTS[moduleId];
          const activeBg = MODULE_BG_ACTIVE[moduleId];

          return (
            <div
              key={moduleId}
              className={`relative rounded-xl border p-6 transition-all ${
                isActive
                  ? `${activeBg} shadow-sm hover:shadow-md`
                  : "border-slate-200 bg-slate-50/50 opacity-75 hover:opacity-100"
              }`}
            >
              {/* Status badge */}
              <div className="absolute top-4 right-4">
                {isActive ? (
                  isTrial ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                      Trial
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                      <Check className="h-3 w-3" />
                      Active
                    </span>
                  )
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                    <Lock className="h-3 w-3" />
                    Locked
                  </span>
                )}
              </div>

              {/* Icon */}
              <div
                className={`inline-flex rounded-xl bg-gradient-to-br ${gradient} p-3 mb-4`}
              >
                <Icon className="h-6 w-6 text-white" />
              </div>

              {/* Content */}
              <h3 className="font-semibold text-lg">{mod.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {mod.tagline}
              </p>
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed line-clamp-2">
                {mod.description}
              </p>

              {/* Features */}
              <ul className="mt-4 space-y-1.5">
                {mod.features.slice(0, 3).map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-xs text-muted-foreground"
                  >
                    <Check className="h-3 w-3 mt-0.5 shrink-0 text-green-500" />
                    {f}
                  </li>
                ))}
              </ul>

              {/* Action */}
              <div className="mt-5">
                {isActive ? (
                  <Link
                    href={mod.href}
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r ${gradient} px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity`}
                  >
                    Open {mod.name.replace("MMC ", "")}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <Link
                    href="/billing"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Subscribe — ${mod.price}/mo
                  </Link>
                )}
              </div>

              {/* Base module indicator */}
              {mod.isBase && (
                <p className="mt-3 text-xs text-center text-muted-foreground">
                  Base module — included in all plans
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Bundle upsell */}
      {!isExpired && status.activeModules.length < 5 && (
        <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold">
                Get all 5 modules for $375/mo
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Save vs subscribing individually. Full platform access with
                compliance, design, costing, directory, and training.
              </p>
            </div>
            <Link
              href="/billing"
              className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              View All Plans
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
