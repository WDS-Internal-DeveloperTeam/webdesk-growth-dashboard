import { describe, expect, it } from "vitest";
import {
  createHelpArticleSchema,
  listHelpArticlesQuerySchema,
  updateHelpArticleSchema,
} from "./help-center.dto.js";

describe("createHelpArticleSchema", () => {
  it("accepts a well-formed article", () => {
    const result = createHelpArticleSchema.safeParse({
      category: "faq",
      title: "How do I reset my password?",
      content: "<p>Use the sign-in page.</p>",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown category", () => {
    const result = createHelpArticleSchema.safeParse({
      category: "not_a_real_category",
      title: "T",
      content: "C",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty content", () => {
    const result = createHelpArticleSchema.safeParse({
      category: "faq",
      title: "T",
      content: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateHelpArticleSchema", () => {
  it("rejects a genuinely empty patch", () => {
    const result = updateHelpArticleSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts a patch with only isPublished set", () => {
    const result = updateHelpArticleSchema.safeParse({ isPublished: true });
    expect(result.success).toBe(true);
  });

  it("never accepts category (create-only, silently stripped by the .omit())", () => {
    const parsed = updateHelpArticleSchema.parse({ title: "New", category: "faq" });
    expect(parsed).not.toHaveProperty("category");
  });

  it("shares its title/content length caps with createHelpArticleSchema (derived via .omit().partial())", () => {
    const overlongTitle = "a".repeat(256);
    const createResult = createHelpArticleSchema.safeParse({
      category: "faq",
      title: overlongTitle,
      content: "c",
    });
    const updateResult = updateHelpArticleSchema.safeParse({ title: overlongTitle });
    expect(createResult.success).toBe(false);
    expect(updateResult.success).toBe(false);
  });
});

describe("listHelpArticlesQuerySchema", () => {
  it("parses isPublished=false as a real boolean false, not truthy-string coercion", () => {
    const result = listHelpArticlesQuerySchema.parse({ isPublished: "false" });
    expect(result.isPublished).toBe(false);
  });

  it("rejects a limit above 200", () => {
    const result = listHelpArticlesQuerySchema.safeParse({ limit: "201" });
    expect(result.success).toBe(false);
  });
});
