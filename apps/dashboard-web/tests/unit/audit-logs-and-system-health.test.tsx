import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import type { AuditEvent } from "@webdesk/shared-types";
import {
  auditLogsAndSystemHealthEventTypeLabel,
  buildAuditLogsAndSystemHealthHref,
  getAuditLogsAndSystemHealthEvents,
  parseAuditLogsAndSystemHealthSearchParams,
} from "../../lib/audit-logs-and-system-health.js";

function eventFixture(id: string, overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id,
    eventType: "login",
    eventCategory: "authentication",
    actorUserId: "11111111-1111-1111-1111-111111111111",
    actorType: "human",
    sessionId: null,
    projectId: null,
    entityType: "user_session",
    entityId: "22222222-2222-2222-2222-222222222222",
    entityVersion: null,
    action: "login",
    beforeState: null,
    afterState: null,
    reason: null,
    relatedGateOrApprovalId: null,
    gitCommitSha: null,
    correlationId: null,
    sourceApplication: "dashboard-api",
    environment: "production",
    confidentialityClassification: "internal",
    retentionCategory: "audit-7y",
    legalHold: false,
    legalHoldReason: null,
    createdAt: "2026-09-07T00:00:00.000Z",
    ...overrides,
  };
}

describe("parseAuditLogsAndSystemHealthSearchParams", () => {
  it("defaults to no filters, offset 0, pageSize 20 when nothing is provided", () => {
    expect(parseAuditLogsAndSystemHealthSearchParams({})).toEqual({
      eventType: null,
      entityType: null,
      entityId: null,
      actorUserId: null,
      projectId: null,
      from: null,
      to: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("parses a valid event type", () => {
    expect(parseAuditLogsAndSystemHealthSearchParams({ eventType: "job_failed" }).eventType).toBe(
      "job_failed",
    );
  });

  it("falls back to null for an event type outside this module's own allowlist instead of passing it through", () => {
    expect(
      parseAuditLogsAndSystemHealthSearchParams({ eventType: "rollback" }).eventType,
    ).toBeNull();
    expect(
      parseAuditLogsAndSystemHealthSearchParams({ eventType: "not_a_real_type" }).eventType,
    ).toBeNull();
  });

  it("clamps a negative offset to 0", () => {
    expect(parseAuditLogsAndSystemHealthSearchParams({ offset: "-10" }).offset).toBe(0);
  });

  it("falls back to defaults for a garbled offset/pageSize", () => {
    expect(
      parseAuditLogsAndSystemHealthSearchParams({ offset: "not-a-number", pageSize: "37" }),
    ).toEqual(
      expect.objectContaining({
        offset: 0,
        pageSize: 20,
      }),
    );
  });

  it("clamps overlong entityType/entityId/actorUserId/projectId values", () => {
    const result = parseAuditLogsAndSystemHealthSearchParams({
      entityType: "x".repeat(100),
      entityId: "y".repeat(200),
      actorUserId: "z".repeat(200),
      projectId: "w".repeat(200),
    });
    expect(result.entityType).toHaveLength(64);
    expect(result.entityId).toHaveLength(128);
    expect(result.actorUserId).toHaveLength(128);
    expect(result.projectId).toHaveLength(128);
  });

  it("takes the first value when a param is duplicated in the URL", () => {
    expect(
      parseAuditLogsAndSystemHealthSearchParams({ eventType: ["job_failed", "job_created"] })
        .eventType,
    ).toBe("job_failed");
  });

  it("parses from/to as plain date strings, clamped to 10 characters", () => {
    expect(
      parseAuditLogsAndSystemHealthSearchParams({
        from: "2026-01-01T00:00:00.000Z",
        to: "2026-01-31",
      }),
    ).toEqual(
      expect.objectContaining({
        from: "2026-01-01",
        to: "2026-01-31",
      }),
    );
  });
});

describe("buildAuditLogsAndSystemHealthHref", () => {
  const baseQuery = {
    eventType: null,
    entityType: null,
    entityId: null,
    actorUserId: null,
    projectId: null,
    from: null,
    to: null,
    offset: 0,
    pageSize: 20 as const,
  };

  it("returns the bare path when nothing diverges from defaults", () => {
    expect(buildAuditLogsAndSystemHealthHref(baseQuery, {})).toBe("/audit-logs-and-system-health");
  });

  it("includes every set filter", () => {
    expect(
      buildAuditLogsAndSystemHealthHref(baseQuery, {
        eventType: "job_failed",
        entityType: "user_session",
        entityId: "e1",
        actorUserId: "a1",
        projectId: "p1",
        from: "2026-01-01",
        to: "2026-01-31",
      }),
    ).toBe(
      "/audit-logs-and-system-health?eventType=job_failed&entityType=user_session&entityId=e1&actorUserId=a1&projectId=p1&from=2026-01-01&to=2026-01-31",
    );
  });

  it("resets offset to 0 when an override other than offset itself is applied", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildAuditLogsAndSystemHealthHref(withOffset, { eventType: "logout" })).toBe(
      "/audit-logs-and-system-health?eventType=logout",
    );
  });

  it("keeps a nonzero offset when explicitly set", () => {
    expect(buildAuditLogsAndSystemHealthHref(baseQuery, { offset: 25 })).toBe(
      "/audit-logs-and-system-health?offset=25",
    );
  });
});

describe("auditLogsAndSystemHealthEventTypeLabel", () => {
  it("labels every one of the module's own real event types with a non-empty string", () => {
    const types: readonly AuditEvent["eventType"][] = [
      "login",
      "login_rejected",
      "logout",
      "session_revoked",
      "permission_change",
      "confidential_field_access_change",
      "user_activation",
      "user_deactivation",
      "retention_run",
      "webhook_processed",
      "job_created",
      "job_completed",
      "job_failed",
      "job_retry_requested",
      "job_cancellation_requested",
      "retention_hold_created",
      "retention_hold_released",
      "notification_created",
      "notification_delivery_outcome",
      "operational_contact_created",
      "operational_contact_updated",
      "system_health_check_recorded",
      "emergency_admin_login",
      "account_recovery_request",
      "account_recovery_decision",
    ];
    types.forEach((type) => {
      expect(auditLogsAndSystemHealthEventTypeLabel(type)).toEqual(expect.any(String));
      expect(auditLogsAndSystemHealthEventTypeLabel(type).length).toBeGreaterThan(0);
    });
  });

  it("falls back to the raw value for a type outside the label map", () => {
    expect(auditLogsAndSystemHealthEventTypeLabel("not_a_real_type" as never)).toBe(
      "not_a_real_type",
    );
  });
});

describe("getAuditLogsAndSystemHealthEvents", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    vi.mocked(cookies).mockResolvedValue({ toString: () => "sid=abc" } as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  const baseQuery = {
    eventType: null,
    entityType: null,
    entityId: null,
    actorUserId: null,
    projectId: null,
    from: null,
    to: null,
    offset: 0,
    pageSize: 20 as const,
  };

  it("throws on a non-OK response instead of silently returning an empty list", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(getAuditLogsAndSystemHealthEvents(baseQuery)).rejects.toThrow(
      /Failed to load audit logs and system health events/,
    );
  });

  it("requests one row past the chosen page size, with every set filter forwarded", async () => {
    const requestedUrls: string[] = [];
    global.fetch = vi.fn((url: string) => {
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [], correlationId: "test" }),
      } as Response);
    }) as typeof fetch;

    await getAuditLogsAndSystemHealthEvents({
      ...baseQuery,
      eventType: "job_failed",
      entityType: "user_session",
      entityId: "e1",
      actorUserId: "11111111-1111-1111-1111-111111111111",
      projectId: "22222222-2222-2222-2222-222222222222",
      from: "2026-01-01",
      to: "2026-01-31",
      offset: 25,
    });

    expect(requestedUrls[0]).toBe(
      "https://api.example.com/audit-logs-and-system-health/events?eventType=job_failed&entityType=user_session&entityId=e1&actorUserId=11111111-1111-1111-1111-111111111111&projectId=22222222-2222-2222-2222-222222222222&from=2026-01-01T00%3A00%3A00.000Z&to=2026-01-31T23%3A59%3A59.999Z&limit=21&offset=25",
    );
  });

  it("omits actorUserId/projectId from the request when they're not UUID-shaped", async () => {
    const requestedUrls: string[] = [];
    global.fetch = vi.fn((url: string) => {
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [], correlationId: "test" }),
      } as Response);
    }) as typeof fetch;

    await getAuditLogsAndSystemHealthEvents({
      ...baseQuery,
      actorUserId: "not-a-uuid",
      projectId: "also-not-a-uuid",
    });

    expect(requestedUrls[0]).toBe(
      "https://api.example.com/audit-logs-and-system-health/events?limit=21&offset=0",
    );
  });

  it("reports hasNextPage: true and trims the extra row when the backend returns one more than the page size", async () => {
    const items = Array.from({ length: 21 }, (_, i) => eventFixture(`e${i}`));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items, correlationId: "test" }),
    } as Response);

    const result = await getAuditLogsAndSystemHealthEvents(baseQuery);

    expect(result.items).toHaveLength(20);
    expect(result.hasNextPage).toBe(true);
  });
});
