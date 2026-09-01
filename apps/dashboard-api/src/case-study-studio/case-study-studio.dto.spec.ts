import { describe, expect, it } from "vitest";
import {
  updateCaseStudyAssetSchema,
  updateCaseStudyConsentSchema,
  updateCaseStudySchema,
} from "./case-study-studio.dto.js";

describe("updateCaseStudySchema", () => {
  // Code-review fix: clientApprovalRequired is a one-time intake decision, not an ordinary
  // patchable field — accepting it through the general content-update route let a caller with
  // edit+approve flip it mid-workflow to silently skip the client_approval stage. It is now
  // excluded from the update schema entirely (create-only, immutable once set).
  it("strips clientApprovalRequired from a patch instead of accepting it", () => {
    const result = updateCaseStudySchema.parse({
      clientName: "Acme Corp",
      clientApprovalRequired: false,
    });

    expect(result).not.toHaveProperty("clientApprovalRequired");
  });

  it("rejects publicId in a patch", () => {
    const result = updateCaseStudySchema.parse({
      clientName: "Acme Corp",
      publicId: "CS-NEW-001",
    });

    expect(result).not.toHaveProperty("publicId");
  });

  it("rejects a genuinely empty patch", () => {
    expect(() => updateCaseStudySchema.parse({})).toThrow();
  });
});

describe("updateCaseStudyAssetSchema", () => {
  it("strips assetId from a patch instead of accepting it", () => {
    const result = updateCaseStudyAssetSchema.parse({ role: "logo", assetId: "asset-2" });

    expect(result).not.toHaveProperty("assetId");
  });
});

describe("updateCaseStudyConsentSchema", () => {
  it("accepts a partial patch of any single field", () => {
    const result = updateCaseStudyConsentSchema.parse({ grantedBy: "Jane Doe" });

    expect(result).toEqual({ grantedBy: "Jane Doe" });
  });
});
