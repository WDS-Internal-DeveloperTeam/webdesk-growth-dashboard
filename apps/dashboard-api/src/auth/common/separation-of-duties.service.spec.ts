import { describe, expect, it } from "vitest";
import { SeparationOfDutiesService } from "./separation-of-duties.service.js";

describe("SeparationOfDutiesService", () => {
  const service = new SeparationOfDutiesService();

  it("throws when the approver and actor are the same", () => {
    expect(() => service.assertDistinctActors("user-1", "user-1", "submitter")).toThrow(
      /Separation of duties/,
    );
  });

  it("includes the caller-supplied context in the error message", () => {
    expect(() => service.assertDistinctActors("user-1", "user-1", "release implementer")).toThrow(
      /release implementer/,
    );
  });

  it("does not throw when the approver and actor are distinct", () => {
    expect(() => service.assertDistinctActors("user-1", "user-2", "submitter")).not.toThrow();
  });
});
