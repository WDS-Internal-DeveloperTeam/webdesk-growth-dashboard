import { describe, expect, it } from "vitest";
import { moduleImplementationStatusBadge } from "../../lib/modules.js";

describe("moduleImplementationStatusBadge", () => {
  it("maps every real implementationStatus value to a distinct 5-bucket badge", () => {
    expect(moduleImplementationStatusBadge("not_started")).toEqual({
      bucket: "neutral",
      label: "Not started",
    });
    expect(moduleImplementationStatusBadge("foundation_only")).toEqual({
      bucket: "neutral",
      label: "Foundation only",
    });
    expect(moduleImplementationStatusBadge("in_development")).toEqual({
      bucket: "informational",
      label: "In development",
    });
    expect(moduleImplementationStatusBadge("ready_for_review")).toEqual({
      bucket: "attention",
      label: "Ready for review",
    });
    expect(moduleImplementationStatusBadge("approved")).toEqual({
      bucket: "healthy",
      label: "Approved",
    });
    expect(moduleImplementationStatusBadge("available")).toEqual({
      bucket: "healthy",
      label: "Available",
    });
    expect(moduleImplementationStatusBadge("deferred")).toEqual({
      bucket: "neutral",
      label: "Deferred",
    });
    expect(moduleImplementationStatusBadge("blocked")).toEqual({
      bucket: "blocked",
      label: "Blocked",
    });
    expect(moduleImplementationStatusBadge("deprecated")).toEqual({
      bucket: "neutral",
      label: "Deprecated",
    });
  });
});
