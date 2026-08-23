import { describe, expect, it } from "vitest";
import { createEntitySchema, createKeywordSchema } from "./keyword-and-entity-library.dto.js";

// Regression test for a code-review finding (module-keyword-and-entity-library): shortTextField
// previously allowed up to 255 characters, but the columns it backs (keywordType/intent/
// funnelStage/country on keywords, entityType on entities — migration 00060) are all VARCHAR(100).
// A value between 101 and 255 characters passed Zod but then crashed the actual INSERT/UPDATE with
// an unhandled Postgres "value too long" 500. shortTextField is now max(100), matching the real
// column width.
describe("createKeywordSchema — shortTextField length", () => {
  const validKeyword = { publicId: "KW-1", queryText: "best seo tools" };

  it("accepts a keywordType at exactly the 100-char column limit", () => {
    const result = createKeywordSchema.parse({ ...validKeyword, keywordType: "a".repeat(100) });
    expect(result.keywordType).toHaveLength(100);
  });

  it("rejects a keywordType over the 100-char column limit, not just the old 255-char one", () => {
    expect(() =>
      createKeywordSchema.parse({ ...validKeyword, keywordType: "a".repeat(150) }),
    ).toThrow();
  });
});

describe("createEntitySchema — shortTextField length", () => {
  const validEntity = { publicId: "ENT-1", name: "Acme" };

  it("accepts an entityType at exactly the 100-char column limit", () => {
    const result = createEntitySchema.parse({ ...validEntity, entityType: "a".repeat(100) });
    expect(result.entityType).toHaveLength(100);
  });

  it("rejects an entityType over the 100-char column limit, not just the old 255-char one", () => {
    expect(() =>
      createEntitySchema.parse({ ...validEntity, entityType: "a".repeat(150) }),
    ).toThrow();
  });
});
