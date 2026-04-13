"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Hammer,
  Calculator,
  Users,
  GraduationCap,
  Check,
  ArrowRight,
  Sparkles,
  Rocket,
  Plus,
  Shield,
  User,
  FileCheck,
  Building2,
  FileText,
  Truck,
  Settings,
  BookOpen,
  Clock,
  DollarSign,
  BarChart3,
  CreditCard,
  FolderOpen,
  LayoutDashboard,
  Menu,
  X,
  Tag,
  Eye,
} from "lucide-react";
import { MODULES, type ModuleId } from "@/lib/stripe/plans";

/* ── Demo banner ── */
function DemoBanner() {
  return (
    <div className="bg-teal-600 text-white text-center text-sm py-2 px-4 font-medium flex items-center justify-center gap-2">
      <Eye className="h-4 w-4" />
      Platform Demo — Sprint 4 Review
    </div>
  );
}

/* ── Sidebar (self-contained, no auth) ── */
const moduleNav = [
  { name: "MMC Comply", icon: FileCheck, color: "bg-teal-700" },
  { name: "MMC Build", icon: Building2, color: "bg-teal-600" },
  { name: "MMC Quote", icon: FileText, color: "bg-teal-500" },
  { name: "MMC Direct", icon: Truck, color: "bg-cyan-700" },
  { name: "MMC Train", icon: GraduationCap, color: "bg-sky-700" },
];

function DemoSidebar({ isOpen }: { isOpen: boolean }) {
  return (
    <aside
      className={`flex h-full flex-col bg-slate-900 text-white transition-all duration-300 overflow-hidden ${
        isOpen ? "w-64" : "w-0"
      }`}
    >
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center px-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 font-bold text-sm text-white">
            M
          </div>
          <span className="text-lg font-bold text-white whitespace-nowrap">
            MMC Build
          </span>
        </div>
      </div>

      {/* Top nav */}
      <nav className="px-3 pt-2 space-y-0.5">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium bg-white/10 text-white whitespace-nowrap">
          <LayoutDashboard className="h-4 w-4 shrink-0" />
          Dashboard
        </div>
        <div className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 whitespace-nowrap">
          <FolderOpen className="h-4 w-4 shrink-0" />
          Projects
        </div>
      </nav>

      <div className="mx-3 my-3 border-t border-white/10" />

      {/* Module nav */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Modules
        </p>
        {moduleNav.map((item) => (
          <div
            key={item.name}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white transition-colors whitespace-nowrap cursor-default"
          >
            <div
              className={`flex h-5 w-5 items-center justify-center rounded ${item.color}`}
            >
              <item.icon className="h-3 w-3 text-white" />
            </div>
            {item.name}
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="mt-auto">
        {/* Usage indicator */}
        <div className="mx-3 mb-3 rounded-lg bg-white/5 px-3 py-2.5">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>Analyses used</span>
            <span className="font-medium text-slate-300">1 / 3</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-teal-500 transition-all"
              style={{ width: "33%" }}
            />
          </div>
        </div>

        <div className="border-t border-white/10 px-3 py-2 space-y-0.5">
          {[
            { name: "Knowledge", icon: BookOpen },
            { name: "Billing", icon: CreditCard },
            { name: "Settings", icon: Settings },
          ].map((item) => (
            <div
              key={item.name}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 whitespace-nowrap cursor-default"
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.name}
            </div>
          ))}
        </div>

        <div className="px-4 py-2 border-t border-white/10">
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <Tag className="w-3 h-3" />
            Design v0.1 &middot; Karen Burns
          </span>
        </div>
      </div>
    </aside>
  );
}

/* ── Module card constants ── */
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

const MODULE_SEQUENCE: Record<ModuleId, number> = {
  build: 1,
  comply: 2,
  quote: 3,
  direct: 4,
  train: 5,
};

const WORKFLOW_STEPS = [
  { num: 1, label: "Build", desc: "Design optimisation", color: "teal" },
  { num: 2, label: "Comply", desc: "NCC compliance check", color: "blue" },
  { num: 3, label: "Quote", desc: "Cost estimation", color: "violet" },
  { num: 4, label: "Directory", desc: "Find MMC trades", color: "amber" },
  { num: 5, label: "Training", desc: "Upskill your team", color: "indigo" },
];

/* ── User dashboard view ── */
function DemoModules() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Your MMC Build modules and subscription status
        </p>
      </div>

      {/* Onboarding for new users */}
      <div className="rounded-xl border-2 border-dashed border-teal-300 bg-gradient-to-br from-teal-50 to-blue-50 p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-teal-100 p-3">
            <Rocket className="h-6 w-6 text-teal-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-teal-900">
              Welcome to MMC Build
            </h2>
            <p className="text-sm text-teal-700 mt-1">
              Get started by creating your first project. The platform guides
              you through a 5-step workflow:
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {WORKFLOW_STEPS.map((step, i) => (
                <div key={step.num} className="flex items-center gap-2">
                  {i > 0 && (
                    <ArrowRight className="h-3.5 w-3.5 text-teal-400" />
                  )}
                  <div className="flex items-center gap-1.5 rounded-full border border-teal-200 bg-white/80 px-3 py-1">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-600 text-[10px] font-bold text-white">
                      {step.num}
                    </span>
                    <span className="text-xs font-medium text-teal-800">
                      {step.label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <button className="mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-700 transition-colors">
              <Plus className="h-4 w-4" />
              Create Your First Project
            </button>
          </div>
        </div>
      </div>

      {/* Trial banner */}
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
                12 days remaining &middot; 1 of 3 compliance runs used
              </p>
              <p className="text-xs text-blue-600 mt-2">
                After your trial, subscribe to individual modules to keep
                access. Everyone keeps MMC Comply as the base module.
              </p>
            </div>
          </div>
          <button className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
            View Plans
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Module grid — all active (trial) */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {(Object.keys(MODULES) as ModuleId[]).map((moduleId) => {
          const mod = MODULES[moduleId];
          const Icon = MODULE_ICONS[moduleId];
          const gradient = MODULE_GRADIENTS[moduleId];
          const activeBg = MODULE_BG_ACTIVE[moduleId];

          return (
            <div
              key={moduleId}
              className={`relative rounded-xl border p-6 transition-all ${activeBg} shadow-sm hover:shadow-md`}
            >
              <div className="absolute top-4 right-4">
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                  Trial
                </span>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <div
                  className={`inline-flex rounded-xl bg-gradient-to-br ${gradient} p-3`}
                >
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-slate-300 text-xs font-bold text-slate-500">
                  {MODULE_SEQUENCE[moduleId]}
                </span>
              </div>

              <h3 className="font-semibold text-lg">{mod.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {mod.tagline}
              </p>
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed line-clamp-2">
                {mod.description}
              </p>

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

              <div className="mt-5">
                <button
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r ${gradient} px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity`}
                >
                  Open {mod.name.replace("MMC ", "")}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

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
      <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold">Get all 5 modules for $375/mo</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Save vs subscribing individually. Full platform access with
              compliance, design, costing, directory, and training.
            </p>
          </div>
          <button className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            View All Plans
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Admin dashboard view ── */
const ADMIN_SECTIONS = [
  {
    title: "Platform Configuration",
    cards: [
      {
        title: "Organisation & Team",
        description:
          "Manage team members, roles, invitations, and org details.",
        icon: Users,
        color: "from-blue-500 to-blue-600",
      },
      {
        title: "Cost Rate Management",
        description:
          "Browse, edit, upload, and manage construction cost rates used by MMC Quote.",
        icon: DollarSign,
        color: "from-violet-500 to-violet-600",
      },
      {
        title: "Knowledge Bases",
        description:
          "Manage NCC volumes, standards, and reference documents for AI compliance.",
        icon: BookOpen,
        color: "from-teal-500 to-teal-600",
      },
      {
        title: "Billing & Subscriptions",
        description:
          "View plans, usage, manage Stripe subscriptions, and payment methods.",
        icon: CreditCard,
        color: "from-emerald-500 to-emerald-600",
      },
    ],
  },
  {
    title: "Operations",
    cards: [
      {
        title: "Directory Admin",
        description:
          "Review and approve trade directory listings for MMC Direct.",
        icon: Users,
        color: "from-amber-500 to-amber-600",
      },
      {
        title: "Training Admin",
        description:
          "Create and manage training courses, lessons, and AI content generation.",
        icon: GraduationCap,
        color: "from-indigo-500 to-indigo-600",
      },
      {
        title: "AI Performance",
        description:
          "Monitor AI usage, costs, latency, model performance, and feedback ratings.",
        icon: BarChart3,
        color: "from-pink-500 to-pink-600",
      },
      {
        title: "R&D Tax Tracking",
        description:
          "Log R&D hours by stage and deliverable for tax incentive claims.",
        icon: Clock,
        color: "from-orange-500 to-orange-600",
      },
    ],
  },
  {
    title: "Content",
    cards: [
      {
        title: "All Projects",
        description:
          "View and manage all projects across the organisation.",
        icon: FolderOpen,
        color: "from-slate-500 to-slate-600",
      },
      {
        title: "General Settings",
        description: "Additional settings and configuration options.",
        icon: Settings,
        color: "from-slate-400 to-slate-500",
      },
    ],
  },
];

function DemoAdmin() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Platform configuration, operations, and monitoring
        </p>
      </div>

      {ADMIN_SECTIONS.map((section) => (
        <div key={section.title}>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {section.title}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {section.cards.map((card) => (
              <div
                key={card.title}
                className="group rounded-xl border bg-card p-5 shadow-sm hover:shadow-md transition-all cursor-default"
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className={`inline-flex rounded-lg bg-gradient-to-br ${card.color} p-2.5`}
                  >
                    <card.icon className="h-5 w-5 text-white" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <h3 className="font-semibold text-sm">{card.title}</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {card.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Main demo page ── */
export default function DemoPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [view, setView] = useState<"user" | "admin">("user");

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <DemoBanner />

      <div className="flex flex-1 overflow-hidden">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div
          className={
            sidebarOpen
              ? "fixed inset-y-0 left-0 z-40 md:relative md:z-0"
              : "hidden md:block"
          }
        >
          <DemoSidebar isOpen={sidebarOpen} />
        </div>

        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header */}
          <header className="flex h-16 shrink-0 items-center justify-between border-b px-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen((prev) => !prev)}
                className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent hover:text-accent-foreground"
              >
                {sidebarOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </button>
              <p className="text-sm text-muted-foreground">
                Demo Organisation Pty Ltd
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium">Demo User</p>
                <p className="text-xs capitalize text-muted-foreground">
                  owner
                </p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                DU
              </div>
            </div>
          </header>

          {/* View toggle + content */}
          <main className="flex-1 overflow-y-auto p-6">
            <div className="space-y-6">
              {/* View toggle */}
              <div className="flex items-center justify-between">
                <div />
                <div className="inline-flex rounded-lg border bg-muted p-1">
                  <button
                    onClick={() => setView("user")}
                    className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                      view === "user"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <User className="h-4 w-4" />
                    User View
                  </button>
                  <button
                    onClick={() => setView("admin")}
                    className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                      view === "admin"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Shield className="h-4 w-4" />
                    Admin View
                  </button>
                </div>
              </div>

              {view === "user" ? <DemoModules /> : <DemoAdmin />}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
