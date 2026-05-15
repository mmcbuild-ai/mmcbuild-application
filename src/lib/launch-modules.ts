import type { ModuleId } from "@/lib/stripe/plans";

export const ALL_MODULES: readonly ModuleId[] = [
  "comply",
  "build",
  "quote",
  "direct",
  "train",
] as const;

function parseLaunchList(raw: string | undefined): readonly ModuleId[] | null {
  if (!raw) return null;
  const parsed = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is ModuleId => (ALL_MODULES as readonly string[]).includes(s));
  return parsed.length > 0 ? parsed : null;
}

export function getLaunchedModules(
  rawEnv: string | undefined = process.env.NEXT_PUBLIC_MODULES_LAUNCH_LIST,
): readonly ModuleId[] {
  return parseLaunchList(rawEnv) ?? ALL_MODULES;
}

export function isModuleLaunched(
  moduleId: ModuleId,
  rawEnv?: string,
): boolean {
  return getLaunchedModules(rawEnv).includes(moduleId);
}

const BYPASS_ROLES: ReadonlySet<string> = new Set(["owner", "admin", "beta"]);

export function canBypassLaunchGate(role: string | null | undefined): boolean {
  return !!role && BYPASS_ROLES.has(role);
}

export function shouldShowComingSoon(
  moduleId: ModuleId,
  role: string | null | undefined,
  rawEnv?: string,
): boolean {
  if (isModuleLaunched(moduleId, rawEnv)) return false;
  return !canBypassLaunchGate(role);
}
