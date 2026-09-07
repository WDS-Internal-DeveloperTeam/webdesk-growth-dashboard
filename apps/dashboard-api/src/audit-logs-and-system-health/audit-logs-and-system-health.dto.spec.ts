import { describe, expect, it } from "vitest";
import { listAuditLogsAndSystemHealthEventsQuerySchema } from "./audit-logs-and-system-health.dto.js";

describe("listAuditLogsAndSystemHealthEventsQuerySchema", () => {
  it("accepts an empty query", () => {
    const result = listAuditLogsAndSystemHealthEventsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("normalizes a single eventType query-string value into an array", () => {
    const result = listAuditLogsAndSystemHealthEventsQuerySchema.safeParse({
      eventType: "login",
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.eventType).toEqual(["login"]);
  });

  it("accepts a repeated eventType query-string value already parsed as an array", () => {
    const result = listAuditLogsAndSystemHealthEventsQuerySchema.safeParse({
      eventType: ["login", "job_failed"],
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.eventType).toEqual(["login", "job_failed"]);
  });

  it("rejects an eventType outside the module's own allowlist (e.g. Decision and Activity Log's own territory)", () => {
    const result = listAuditLogsAndSystemHealthEventsQuerySchema.safeParse({
      eventType: "approval",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed projectId", () => {
    const result = listAuditLogsAndSystemHealthEventsQuerySchema.safeParse({
      projectId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("coerces string limit/offset query values to numbers", () => {
    const result = listAuditLogsAndSystemHealthEventsQuerySchema.safeParse({
      limit: "5",
      offset: "10",
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.limit).toBe(5);
    expect(result.success && result.data.offset).toBe(10);
  });

  it("accepts a limit of 101 — one row past dashboard-web's largest 100-row page size, the +1 'has a next page' pagination trick every sibling list page uses", () => {
    const result = listAuditLogsAndSystemHealthEventsQuerySchema.safeParse({ limit: "101" });
    expect(result.success).toBe(true);
    expect(result.success && result.data.limit).toBe(101);
  });

  it("rejects a limit above 200 — matching every sibling module's own list-query cap", () => {
    const result = listAuditLogsAndSystemHealthEventsQuerySchema.safeParse({ limit: "201" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-ISO from/to value", () => {
    const result = listAuditLogsAndSystemHealthEventsQuerySchema.safeParse({ from: "not-a-date" });
    expect(result.success).toBe(false);
  });
});
