import { describe, expect, it } from "vitest";
import { listDecisionAndActivityLogEventsQuerySchema } from "./decision-and-activity-log.dto.js";

describe("listDecisionAndActivityLogEventsQuerySchema", () => {
  it("accepts an empty query", () => {
    const result = listDecisionAndActivityLogEventsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("normalizes a single eventType query-string value into an array", () => {
    const result = listDecisionAndActivityLogEventsQuerySchema.safeParse({
      eventType: "approval",
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.eventType).toEqual(["approval"]);
  });

  it("accepts a repeated eventType query-string value already parsed as an array", () => {
    const result = listDecisionAndActivityLogEventsQuerySchema.safeParse({
      eventType: ["approval", "rollback"],
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.eventType).toEqual(["approval", "rollback"]);
  });

  it("rejects an eventType outside the module's own allowlist", () => {
    const result = listDecisionAndActivityLogEventsQuerySchema.safeParse({
      eventType: "login",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed projectId", () => {
    const result = listDecisionAndActivityLogEventsQuerySchema.safeParse({
      projectId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("coerces string limit/offset query values to numbers", () => {
    const result = listDecisionAndActivityLogEventsQuerySchema.safeParse({
      limit: "5",
      offset: "10",
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.limit).toBe(5);
    expect(result.success && result.data.offset).toBe(10);
  });

  it("rejects a limit above 100", () => {
    const result = listDecisionAndActivityLogEventsQuerySchema.safeParse({ limit: "101" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-ISO from/to value", () => {
    const result = listDecisionAndActivityLogEventsQuerySchema.safeParse({ from: "not-a-date" });
    expect(result.success).toBe(false);
  });
});
