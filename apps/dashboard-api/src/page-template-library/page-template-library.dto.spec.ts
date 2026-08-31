import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createPageTemplateSchema, updatePageTemplateSchema } from "./page-template-library.dto.js";

// Regression test for a code-review finding (module-page-template-library): nothing rejected the
// same section recordId appearing in both requiredSectionIds and optionalSectionIds on the same
// page template, which would be ambiguous for any future UI rendering "required" vs. "optional"
// sections. Both create and update now reject the overlap with a clean 400 at the DTO layer.
describe("createPageTemplateSchema — requiredSectionIds/optionalSectionIds overlap", () => {
  const base = { publicId: "PT-1", pageType: "homepage" as const, name: "Homepage" };

  it("rejects an id present in both requiredSectionIds and optionalSectionIds", () => {
    const sharedId = randomUUID();
    expect(() =>
      createPageTemplateSchema.parse({
        ...base,
        requiredSectionIds: [sharedId],
        optionalSectionIds: [sharedId, randomUUID()],
      }),
    ).toThrow(/cannot be both required and optional/);
  });

  it("accepts disjoint requiredSectionIds and optionalSectionIds", () => {
    const result = createPageTemplateSchema.parse({
      ...base,
      requiredSectionIds: [randomUUID()],
      optionalSectionIds: [randomUUID()],
    });
    expect(result.requiredSectionIds).toHaveLength(1);
    expect(result.optionalSectionIds).toHaveLength(1);
  });

  it("accepts when only one of the two fields is provided", () => {
    expect(() =>
      createPageTemplateSchema.parse({ ...base, requiredSectionIds: [randomUUID()] }),
    ).not.toThrow();
  });
});

describe("updatePageTemplateSchema — requiredSectionIds/optionalSectionIds overlap", () => {
  it("rejects an id present in both fields within the same patch", () => {
    const sharedId = randomUUID();
    expect(() =>
      updatePageTemplateSchema.parse({
        requiredSectionIds: [sharedId],
        optionalSectionIds: [sharedId],
      }),
    ).toThrow(/cannot be both required and optional/);
  });

  it("accepts a patch that only touches one of the two fields", () => {
    expect(() =>
      updatePageTemplateSchema.parse({ requiredSectionIds: [randomUUID()] }),
    ).not.toThrow();
  });
});
