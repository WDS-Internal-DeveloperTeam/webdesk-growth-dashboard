import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import type { Notification } from "@webdesk/shared-types";
import {
  buildNotificationCenterHref,
  getNotification,
  getNotifications,
  notificationDeliveryStateBadge,
  notificationDeliveryStateLabel,
  notificationSeverityBadge,
  parseNotificationCenterSearchParams,
} from "../../lib/notification-center.js";

function notificationFixture(id: string, overrides: Partial<Notification> = {}): Notification {
  return {
    id,
    notificationType: "review_assigned",
    severity: "medium",
    operationalArea: null,
    projectId: null,
    recipientUserId: "11111111-1111-1111-1111-111111111111",
    recipientContactId: null,
    subject: "You have a new review assigned",
    bodyReference: null,
    deliveryState: "queued",
    attemptCount: 0,
    lastAttemptAt: null,
    failureSummary: null,
    retryEligible: true,
    correlationId: null,
    relatedEntityType: null,
    relatedEntityId: null,
    retentionCategory: null,
    createdAt: "2026-09-03T00:00:00.000Z",
    updatedAt: "2026-09-03T00:00:00.000Z",
    ...overrides,
  };
}

describe("parseNotificationCenterSearchParams", () => {
  it("defaults to no filters, offset 0, pageSize 20 when nothing is provided", () => {
    expect(parseNotificationCenterSearchParams({})).toEqual({
      deliveryState: null,
      projectId: null,
      notificationType: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("parses a valid delivery state", () => {
    expect(parseNotificationCenterSearchParams({ deliveryState: "retrying" }).deliveryState).toBe(
      "retrying",
    );
  });

  it("falls back to null for a delivery state outside the real enum", () => {
    expect(
      parseNotificationCenterSearchParams({ deliveryState: "not_a_real_state" }).deliveryState,
    ).toBeNull();
  });

  it("clamps a negative offset to 0", () => {
    expect(parseNotificationCenterSearchParams({ offset: "-10" }).offset).toBe(0);
  });

  it("falls back to defaults for a garbled offset/pageSize", () => {
    expect(parseNotificationCenterSearchParams({ offset: "not-a-number", pageSize: "37" })).toEqual(
      expect.objectContaining({ offset: 0, pageSize: 20 }),
    );
  });

  it("clamps overlong projectId/notificationType values", () => {
    const result = parseNotificationCenterSearchParams({
      projectId: "p".repeat(200),
      notificationType: "t".repeat(100),
    });
    expect(result.projectId).toHaveLength(128);
    expect(result.notificationType).toHaveLength(64);
  });

  it("takes the first value when a param is duplicated in the URL", () => {
    expect(
      parseNotificationCenterSearchParams({ deliveryState: ["retrying", "failed"] }).deliveryState,
    ).toBe("retrying");
  });
});

describe("buildNotificationCenterHref", () => {
  const baseQuery = {
    deliveryState: null,
    projectId: null,
    notificationType: null,
    offset: 0,
    pageSize: 20 as const,
  };

  it("returns the bare path when nothing diverges from defaults", () => {
    expect(buildNotificationCenterHref(baseQuery, {})).toBe("/notification-center");
  });

  it("includes every set filter", () => {
    expect(
      buildNotificationCenterHref(baseQuery, {
        deliveryState: "failed",
        projectId: "p1",
        notificationType: "review_assigned",
      }),
    ).toBe(
      "/notification-center?deliveryState=failed&projectId=p1&notificationType=review_assigned",
    );
  });

  it("resets offset to 0 when an override other than offset itself is applied", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildNotificationCenterHref(withOffset, { deliveryState: "failed" })).toBe(
      "/notification-center?deliveryState=failed",
    );
  });

  it("keeps a nonzero offset when explicitly set", () => {
    expect(buildNotificationCenterHref(baseQuery, { offset: 25 })).toBe(
      "/notification-center?offset=25",
    );
  });
});

describe("notificationDeliveryStateLabel / notificationDeliveryStateBadge", () => {
  it("labels and badges every real delivery state", () => {
    const states: readonly Notification["deliveryState"][] = [
      "queued",
      "sent_to_smtp",
      "accepted",
      "failed",
      "retrying",
      "permanently_failed",
    ];
    states.forEach((state) => {
      expect(notificationDeliveryStateLabel(state).length).toBeGreaterThan(0);
      expect(notificationDeliveryStateBadge(state).label.length).toBeGreaterThan(0);
    });
  });

  it("marks accepted as the only healthy state", () => {
    expect(notificationDeliveryStateBadge("accepted").token).toBe("healthy");
    expect(notificationDeliveryStateBadge("failed").token).toBe("unavailable");
    expect(notificationDeliveryStateBadge("permanently_failed").token).toBe("unavailable");
  });
});

describe("notificationSeverityBadge", () => {
  it("badges every real severity", () => {
    const severities: readonly Notification["severity"][] = ["critical", "high", "medium", "low"];
    severities.forEach((severity) => {
      expect(notificationSeverityBadge(severity).label.length).toBeGreaterThan(0);
    });
  });
});

describe("getNotifications", () => {
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
    deliveryState: null,
    projectId: null,
    notificationType: null,
    offset: 0,
    pageSize: 20 as const,
  };

  it("throws on a non-OK response instead of silently returning an empty list", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(getNotifications(baseQuery)).rejects.toThrow(/Failed to load notifications/);
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

    await getNotifications({
      ...baseQuery,
      deliveryState: "retrying",
      projectId: "22222222-2222-2222-2222-222222222222",
      notificationType: "review_assigned",
      offset: 25,
    });

    expect(requestedUrls[0]).toBe(
      "https://api.example.com/notifications?deliveryState=retrying&projectId=22222222-2222-2222-2222-222222222222&notificationType=review_assigned&limit=21&offset=25",
    );
  });

  it("omits projectId from the request when it's not UUID-shaped", async () => {
    const requestedUrls: string[] = [];
    global.fetch = vi.fn((url: string) => {
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [], correlationId: "test" }),
      } as Response);
    }) as typeof fetch;

    await getNotifications({ ...baseQuery, projectId: "not-a-uuid" });

    expect(requestedUrls[0]).toBe("https://api.example.com/notifications?limit=21&offset=0");
  });

  it("reports hasNextPage: true and trims the extra row when the backend returns one more than the page size", async () => {
    const items = Array.from({ length: 21 }, (_, i) => notificationFixture(`n${i}`));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items, correlationId: "test" }),
    } as Response);

    const result = await getNotifications(baseQuery);

    expect(result.items).toHaveLength(20);
    expect(result.hasNextPage).toBe(true);
  });
});

describe("getNotification", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    vi.mocked(cookies).mockResolvedValue({ toString: () => "sid=abc" } as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns null for a malformed id without making a network call", async () => {
    global.fetch = vi.fn();
    expect(await getNotification("not-a-uuid")).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns null on a 404", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getNotification("11111111-1111-1111-1111-111111111111")).toBeNull();
  });

  it("throws on a non-404 non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(getNotification("11111111-1111-1111-1111-111111111111")).rejects.toThrow(
      /Failed to load notification/,
    );
  });

  it("returns the notification on success", async () => {
    const notification = notificationFixture("11111111-1111-1111-1111-111111111111");
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: notification, correlationId: "test" }),
    } as Response);

    expect(await getNotification(notification.id)).toEqual(notification);
  });
});
