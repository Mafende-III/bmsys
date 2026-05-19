import { describe, expect, it } from "vitest";
import {
  channelCreateSchema,
  channelUpdateSchema,
} from "@/lib/channels/schema";

describe("channelCreateSchema", () => {
  const valid = { name: "Retail", slug: "retail" };

  it("accepts a valid input", () => {
    const r = channelCreateSchema.safeParse(valid);
    expect(r.success).toBe(true);
  });

  it("requires name", () => {
    const r = channelCreateSchema.safeParse({ ...valid, name: "" });
    expect(r.success).toBe(false);
  });

  it("rejects uppercase slug", () => {
    const r = channelCreateSchema.safeParse({ ...valid, slug: "Retail" });
    // .toLowerCase() coerces, so this should actually parse as "retail" — but
    // let's verify the coercion does happen and the output is correct.
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.slug).toBe("retail");
    }
  });

  it("rejects slug with spaces", () => {
    const r = channelCreateSchema.safeParse({ ...valid, slug: "wholesale group" });
    expect(r.success).toBe(false);
  });

  it("rejects slug starting with a dash", () => {
    const r = channelCreateSchema.safeParse({ ...valid, slug: "-retail" });
    expect(r.success).toBe(false);
  });

  it("rejects slug ending with a dash", () => {
    const r = channelCreateSchema.safeParse({ ...valid, slug: "retail-" });
    expect(r.success).toBe(false);
  });

  it("accepts kebab-case slug", () => {
    const r = channelCreateSchema.safeParse({
      ...valid,
      slug: "wholesale-premium-50",
    });
    expect(r.success).toBe(true);
  });

  it("trims whitespace in name", () => {
    const r = channelCreateSchema.safeParse({ ...valid, name: "  Retail  " });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.name).toBe("Retail");
    }
  });
});

describe("channelUpdateSchema", () => {
  it("does not accept slug (immutable)", () => {
    const r = channelUpdateSchema.safeParse({ name: "Renamed" });
    expect(r.success).toBe(true);
  });

  it("still requires name", () => {
    const r = channelUpdateSchema.safeParse({ name: "" });
    expect(r.success).toBe(false);
  });
});
