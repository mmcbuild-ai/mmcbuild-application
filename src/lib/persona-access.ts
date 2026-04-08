import type { ModuleId } from "@/lib/stripe/plans";

export type UserPersona =
  | "builder"
  | "developer"
  | "architect_bd"
  | "design_and_build"
  | "consultant"
  | "trade"
  | "admin";

export type SubscriptionTier = "trial" | "pro" | "enterprise";

export const PERSONA_LABELS: Record<UserPersona, string> = {
  builder: "Builder",
  developer: "Property Developer",
  architect_bd: "Architect / Building Designer",
  design_and_build: "Design & Build",
  consultant: "Consultant",
  trade: "Trade",
  admin: "Admin",
};

export const PERSONA_DESCRIPTIONS: Record<UserPersona, string> = {
  builder: "Residential builders managing compliance, costs, and trades",
  developer: "Property developers overseeing multiple projects",
  architect_bd: "Architects and building designers creating compliant designs",
  design_and_build: "Design and build firms handling end-to-end delivery",
  consultant: "Certifiers, surveyors, planners, and engineers",
  trade: "Trade contractors and subcontractors",
  admin: "Platform administrator",
};

// Which modules each persona can access
// Tier controls run limits, NOT module visibility
const MODULE_ACCESS: Record<UserPersona, ModuleId[]> = {
  builder: ["comply", "build", "quote", "direct", "train"],
  developer: ["comply", "build", "quote", "direct"],
  architect_bd: ["comply", "build", "direct"],
  design_and_build: ["build", "quote"],
  consultant: ["comply"],
  trade: [], // no modules defined yet — show all as locked "Coming Soon"
  admin: ["comply", "build", "quote", "direct", "train"],
};

// Modules that consume analysis runs (subject to trial limits)
export const RUN_LIMITED_MODULES: ModuleId[] = ["comply", "build", "quote"];

export const TRIAL_RUN_LIMIT = 10;

export function canAccessModule(
  persona: UserPersona | null | undefined,
  moduleId: ModuleId
): boolean {
  if (!persona) return false;
  if (persona === "admin") return true;
  return MODULE_ACCESS[persona]?.includes(moduleId) ?? false;
}

export function getAccessibleModules(
  persona: UserPersona | null | undefined
): ModuleId[] {
  if (!persona) return [];
  if (persona === "admin")
    return ["comply", "build", "quote", "direct", "train"];
  return MODULE_ACCESS[persona] ?? [];
}

export function isTradePersona(
  persona: UserPersona | null | undefined
): boolean {
  return persona === "trade";
}

export function isRunLimited(
  tier: string | null | undefined
): boolean {
  return !tier || tier === "trial";
}

export function isRunLimitedModule(moduleId: ModuleId): boolean {
  return RUN_LIMITED_MODULES.includes(moduleId);
}
