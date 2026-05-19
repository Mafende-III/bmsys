import { describe, expect, it } from "vitest";
import {
  supplierCreateSchema,
  supplierUpdateSchema,
} from "@/lib/suppliers/schema";

describe("supplierCreateSchema", () => {
  it("accepts a minimal valid input (name only)", () => {
    const r = supplierCreateSchema.safeParse({ name: "Acme" });
    expect(r.success).toBe(true);
  });

  it("accepts name + phone + notes", () => {
    const r = supplierCreateSchema.safeParse({
      name: "Acme",
      phone: "+250788000000",
      notes: "Net-30 terms, biweekly delivery",
    });
    expect(r.success).toBe(true);
  });

  it("trims name and strips empty phone/notes to undefined", () => {
    const r = supplierCreateSchema.safeParse({
      name: "  Acme  ",
      phone: "   ",
      notes: "  ",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.name).toBe("Acme");
      expect(r.data.phone).toBeUndefined();
      expect(r.data.notes).toBeUndefined();
    }
  });

  it("rejects empty name", () => {
    const r = supplierCreateSchema.safeParse({ name: "" });
    expect(r.success).toBe(false);
  });

  it("rejects malformed phone", () => {
    const r = supplierCreateSchema.safeParse({
      name: "Acme",
      phone: "not-a-phone",
    });
    expect(r.success).toBe(false);
  });
});

describe("supplierUpdateSchema", () => {
  it("has the same rules as create", () => {
    const r = supplierUpdateSchema.safeParse({ name: "Renamed" });
    expect(r.success).toBe(true);
  });
});
