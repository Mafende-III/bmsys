import { describe, expect, it } from "vitest";
import {
  productCreateSchema,
  productUpdateSchema,
} from "@/lib/products/schema";

const validInput = {
  sku: "WATER-500",
  name: "Test Water 500ML",
  categoryId: "cat_test_id",
  iconEmoji: "💧",
  unitsPerCarton: 12,
  costPerCarton: 4500,
  unitPrice: 600,
  cartonPrice: 6800,
  sellableAsUnit: true,
  sellableAsCarton: true,
  lowStockThresholdUnits: 0,
  loyaltyPointsPerUnit: 0,
};

describe("productCreateSchema", () => {
  it("accepts a valid input", () => {
    const r = productCreateSchema.safeParse(validInput);
    expect(r.success).toBe(true);
  });

  it("rejects empty SKU", () => {
    const r = productCreateSchema.safeParse({ ...validInput, sku: "" });
    expect(r.success).toBe(false);
  });

  it("rejects SKU containing whitespace", () => {
    const r = productCreateSchema.safeParse({ ...validInput, sku: "BAD SKU" });
    expect(r.success).toBe(false);
  });

  it("accepts SKU with allowed punctuation", () => {
    const r = productCreateSchema.safeParse({
      ...validInput,
      sku: "BEER.PRIMUS_72-CL",
    });
    expect(r.success).toBe(true);
  });

  it("rejects when both sellable flags are false", () => {
    const r = productCreateSchema.safeParse({
      ...validInput,
      sellableAsUnit: false,
      sellableAsCarton: false,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.errors[0]?.message).toMatch(/sellable/i);
    }
  });

  it("rejects negative price", () => {
    const r = productCreateSchema.safeParse({ ...validInput, unitPrice: -1 });
    expect(r.success).toBe(false);
  });

  it("rejects non-integer price", () => {
    const r = productCreateSchema.safeParse({
      ...validInput,
      unitPrice: 600.5,
    });
    expect(r.success).toBe(false);
  });

  it("rejects unitsPerCarton < 1", () => {
    const r = productCreateSchema.safeParse({
      ...validInput,
      unitsPerCarton: 0,
    });
    expect(r.success).toBe(false);
  });

  it("trims name", () => {
    const r = productCreateSchema.safeParse({
      ...validInput,
      name: "  Padded  ",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.name).toBe("Padded");
    }
  });

  it("treats blank categoryId as null", () => {
    const r = productCreateSchema.safeParse({ ...validInput, categoryId: "" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.categoryId).toBeNull();
    }
  });

  it("treats blank iconEmoji as null", () => {
    const r = productCreateSchema.safeParse({ ...validInput, iconEmoji: "" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.iconEmoji).toBeNull();
    }
  });

  it("coerces stringy numbers from form data", () => {
    const r = productCreateSchema.safeParse({
      ...validInput,
      unitsPerCarton: "12",
      costPerCarton: "4500",
      unitPrice: "600",
      cartonPrice: "6800",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.unitsPerCarton).toBe(12);
      expect(r.data.cartonPrice).toBe(6800);
    }
  });
});

describe("productUpdateSchema", () => {
  it("does not accept SKU (cannot change after creation)", () => {
    const { sku, ...rest } = validInput;
    void sku;
    const r = productUpdateSchema.safeParse(rest);
    expect(r.success).toBe(true);
  });

  it("still enforces the at-least-one-sellable rule", () => {
    const { sku, ...rest } = validInput;
    void sku;
    const r = productUpdateSchema.safeParse({
      ...rest,
      sellableAsUnit: false,
      sellableAsCarton: false,
    });
    expect(r.success).toBe(false);
  });
});
