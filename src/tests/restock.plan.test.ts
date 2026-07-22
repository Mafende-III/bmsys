import { describe, expect, it } from "vitest";
import { computeRestockLine } from "@/lib/restock/plan";

describe("computeRestockLine", () => {
  it("suggests enough cartons to reach 30-day cover, rounded up", () => {
    // 8 units/day burn (112 over 14 days), 0 in stock, 12/carton →
    // target 240 units → 20 cartons.
    const r = computeRestockLine({
      stockUnits: 0,
      unitsSoldInWindow: 112,
      unitsPerCarton: 12,
      costPerCarton: 4200,
    });
    expect(r.dailyBurn).toBe(8);
    expect(r.urgency).toBe("OUT");
    expect(r.suggestedCartons).toBe(20);
    expect(r.suggestedUnits).toBe(240);
    expect(r.estimatedCost).toBe(20 * 4200);
  });

  it("deducts current stock from the target before rounding", () => {
    // 2 units/day (28/14d), 30 in stock → target 60 → deficit 30 →
    // 3 cartons of 12 (36 units).
    const r = computeRestockLine({
      stockUnits: 30,
      unitsSoldInWindow: 28,
      unitsPerCarton: 12,
      costPerCarton: 6000,
    });
    expect(r.daysToOut).toBe(15);
    expect(r.urgency).toBe("OK");
    expect(r.suggestedCartons).toBe(3);
    expect(r.estimatedCost).toBe(18000);
  });

  it("flags CRITICAL at ≤3 days and LOW at ≤7 days", () => {
    const critical = computeRestockLine({
      stockUnits: 6,
      unitsSoldInWindow: 28, // 2/day → 3 days left
      unitsPerCarton: 12,
      costPerCarton: 6000,
    });
    expect(critical.urgency).toBe("CRITICAL");

    const low = computeRestockLine({
      stockUnits: 10,
      unitsSoldInWindow: 28, // 2/day → 5 days left
      unitsPerCarton: 12,
      costPerCarton: 6000,
    });
    expect(low.urgency).toBe("LOW");
  });

  it("suggests nothing for covered products", () => {
    // 1/day, 60 in stock → 60 days of cover, no order.
    const r = computeRestockLine({
      stockUnits: 60,
      unitsSoldInWindow: 14,
      unitsPerCarton: 12,
      costPerCarton: 6000,
    });
    expect(r.urgency).toBe("OK");
    expect(r.suggestedCartons).toBe(0);
    expect(r.estimatedCost).toBe(0);
  });

  it("treats zero-sales products as dormant, never orders", () => {
    const r = computeRestockLine({
      stockUnits: 0,
      unitsSoldInWindow: 0,
      unitsPerCarton: 12,
      costPerCarton: 6000,
    });
    expect(r.daysToOut).toBeNull();
    expect(r.urgency).toBe("OK");
    expect(r.suggestedCartons).toBe(0);
  });

  it("handles unitsPerCarton=1 (18.9L bottles) without division surprises", () => {
    // 5.3/day ≈ 74/14d, 67 in stock → target ceil(5.2857×30)=159 →
    // deficit 92 → 92 "cartons" (bottles).
    const r = computeRestockLine({
      stockUnits: 67,
      unitsSoldInWindow: 74,
      unitsPerCarton: 1,
      costPerCarton: 2800,
    });
    expect(r.daysToOut).toBe(12);
    expect(r.suggestedCartons).toBe(92);
    expect(r.estimatedCost).toBe(92 * 2800);
  });
});
