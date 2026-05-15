import { describe, it, expect } from "vitest";
import {
  ALL_MODULES,
  getLaunchedModules,
  isModuleLaunched,
  canBypassLaunchGate,
  shouldShowComingSoon,
} from "@/lib/launch-modules";

describe("launch-modules", () => {
  describe("getLaunchedModules", () => {
    it("returns all modules when env is undefined", () => {
      expect(getLaunchedModules(undefined)).toEqual(ALL_MODULES);
    });

    it("returns all modules when env is empty string", () => {
      expect(getLaunchedModules("")).toEqual(ALL_MODULES);
    });

    it("returns only the listed modules", () => {
      expect(getLaunchedModules("comply,build")).toEqual(["comply", "build"]);
    });

    it("trims whitespace and lowercases", () => {
      expect(getLaunchedModules(" Comply , BUILD ,quote ")).toEqual([
        "comply",
        "build",
        "quote",
      ]);
    });

    it("ignores unknown module ids", () => {
      expect(getLaunchedModules("comply,not-a-module,build")).toEqual([
        "comply",
        "build",
      ]);
    });

    it("falls back to all modules when no valid ids remain", () => {
      expect(getLaunchedModules("foo,bar")).toEqual(ALL_MODULES);
    });
  });

  describe("isModuleLaunched", () => {
    it("true when module is in list", () => {
      expect(isModuleLaunched("comply", "comply,build")).toBe(true);
    });

    it("false when module not in list", () => {
      expect(isModuleLaunched("direct", "comply,build")).toBe(false);
    });

    it("true for all modules when env unset", () => {
      for (const m of ALL_MODULES) {
        expect(isModuleLaunched(m, undefined)).toBe(true);
      }
    });
  });

  describe("canBypassLaunchGate", () => {
    it.each(["owner", "admin", "beta"])("true for role %s", (role) => {
      expect(canBypassLaunchGate(role)).toBe(true);
    });

    it.each(["member", "viewer", "trial", null, undefined, ""])(
      "false for role %s",
      (role) => {
        expect(canBypassLaunchGate(role)).toBe(false);
      },
    );
  });

  describe("shouldShowComingSoon", () => {
    it("false when module is launched (regardless of role)", () => {
      expect(shouldShowComingSoon("comply", null, "comply,build")).toBe(false);
      expect(shouldShowComingSoon("comply", "admin", "comply,build")).toBe(false);
    });

    it("true when module is gated and user has no bypass role", () => {
      expect(shouldShowComingSoon("direct", "member", "comply,build")).toBe(true);
      expect(shouldShowComingSoon("train", null, "comply,build")).toBe(true);
    });

    it("false when module is gated but user can bypass", () => {
      expect(shouldShowComingSoon("direct", "admin", "comply,build")).toBe(false);
      expect(shouldShowComingSoon("train", "owner", "comply,build")).toBe(false);
      expect(shouldShowComingSoon("direct", "beta", "comply,build")).toBe(false);
    });
  });
});
