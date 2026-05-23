import { describe, it, expect } from "vitest";
import { computeEstimateRange } from "@/lib/estimation/compute-range";
import type { RateResult } from "@/lib/ai/agent/tools/lookup-cost-rate";

function rate(element: string, base_rate: number, unit = "m2"): RateResult {
  return {
    element,
    unit,
    base_rate,
    state: "NSW",
    year: 2025,
    source_name: "test",
    source_detail: null,
    is_override: false,
  };
}

describe("computeEstimateRange (deterministic marketplace estimate)", () => {
  it("returns a null range when no rates match", () => {
    expect(computeEstimateRange([], 10, 1)).toEqual({
      lowCents: null,
      highCents: null,
      lineItems: [],
    });
  });

  it("applies a ±15% indicative band on a single rate × quantity", () => {
    // 100 * 1 * 2 = 200 → 170.00 .. 230.00
    const r = computeEstimateRange([rate("cladding", 100)], 2, 1);
    expect(r.lowCents).toBe(17000);
    expect(r.highCents).toBe(23000);
    expect(r.lineItems).toHaveLength(1);
  });

  it("applies the regional multiplier deterministically", () => {
    // QLD multiplier 0.88: 100 * 0.88 = 88 → 74.80 .. 101.20
    const r = computeEstimateRange([rate("cladding", 100)], 1, 0.88);
    expect(r.lowCents).toBe(7480);
    expect(r.highCents).toBe(10120);
  });

  it("spans the range across multiple alternative rates", () => {
    // a: 85..115, b: 170..230 → overall 85..230
    const r = computeEstimateRange([rate("a", 100), rate("b", 200)], 1, 1);
    expect(r.lowCents).toBe(8500);
    expect(r.highCents).toBe(23000);
    expect(r.lineItems).toHaveLength(2);
  });

  it("defaults a missing or non-positive quantity to 1", () => {
    const missing = computeEstimateRange([rate("x", 100)], undefined, 1);
    const zero = computeEstimateRange([rate("x", 100)], 0, 1);
    expect(missing).toEqual(zero);
    expect(missing.lowCents).toBe(8500);
  });

  it("never returns a negative low bound", () => {
    const r = computeEstimateRange([rate("x", 0)], 1, 1);
    expect(r.lowCents).toBe(0);
    expect(r.highCents).toBe(0);
  });
});
