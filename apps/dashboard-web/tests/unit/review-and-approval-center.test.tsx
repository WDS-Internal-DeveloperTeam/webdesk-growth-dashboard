import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import type {
  ModuleRegistrySummary,
  Review,
  ReviewComment,
  ReviewDecision,
} from "@webdesk/shared-types";
import {
  buildReviewsHref,
  getModuleRegistry,
  getReview,
  getReviewComments,
  getReviewDecisions,
  getReviews,
  moduleDisplayName,
  parseReviewsSearchParams,
  REVIEW_DECISION_ACTION_LABEL,
  reviewStatusBadge,
  sortModulesForPicker,
} from "../../lib/review-and-approval-center.js";

function reviewFixture(id: string, overrides: Partial<Review> = {}): Review {
  return {
    id,
    targetModuleKey: "business_knowledge",
    targetId: "22222222-2222-2222-2222-222222222222",
    targetLabel: null,
    status: "submitted",
    isPaused: false,
    submittedByUserId: "33333333-3333-3333-3333-333333333333",
    assignedToUserId: null,
    decidedByUserId: null,
    decidedAt: null,
    versionALabel: null,
    versionBLabel: null,
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
    ...overrides,
  };
}

function moduleFixture(
  key: string,
  overrides: Partial<ModuleRegistrySummary> = {},
): ModuleRegistrySummary {
  return {
    id: `module-${key}`,
    key,
    name: key,
    permissionGroupKey: key,
    displayName: null,
    description: null,
    navigationGroup: "workflow",
    navigationOrder: 1,
    route: `/${key}`,
    iconReference: null,
    v1InclusionStatus: "included",
    implementationStatus: "available",
    viewPermissionAction: "view",
    actionPermissions: null,
    featureStatus: null,
    documentationReference: null,
    helpDocumentReference: null,
    owner: null,
    dependencies: null,
    confidentialityLevel: null,
    badgeSupport: false,
    deprecationReference: null,
    ...overrides,
  };
}

describe("parseReviewsSearchParams", () => {
  it("defaults to assignedToMe: true (the inbox view), no filters, offset 0, pageSize 20 when nothing is provided", () => {
    expect(parseReviewsSearchParams({})).toEqual({
      status: null,
      targetModuleKey: null,
      search: null,
      assignedToMe: true,
      offset: 0,
      pageSize: 20,
    });
  });

  it("parses valid status/targetModuleKey/search/offset/pageSize values", () => {
    expect(
      parseReviewsSearchParams({
        status: "approved",
        targetModuleKey: "service_library",
        search: "uptime",
        offset: "25",
        pageSize: "50",
      }),
    ).toEqual({
      status: "approved",
      targetModuleKey: "service_library",
      search: "uptime",
      assignedToMe: true,
      offset: 25,
      pageSize: 50,
    });
  });

  it("only an explicit assignedToMe=false switches off the default inbox view", () => {
    expect(parseReviewsSearchParams({ assignedToMe: "false" }).assignedToMe).toBe(false);
    expect(parseReviewsSearchParams({ assignedToMe: "true" }).assignedToMe).toBe(true);
    expect(parseReviewsSearchParams({ assignedToMe: "garbage" }).assignedToMe).toBe(true);
  });

  it("falls back to defaults for an invalid/garbled status instead of passing it through", () => {
    expect(
      parseReviewsSearchParams({
        status: "not_a_real_status",
        offset: "not-a-number",
        pageSize: "37",
      }),
    ).toEqual({
      status: null,
      targetModuleKey: null,
      search: null,
      assignedToMe: true,
      offset: 0,
      pageSize: 20,
    });
  });

  it("clamps a negative offset to 0", () => {
    expect(parseReviewsSearchParams({ offset: "-10" }).offset).toBe(0);
  });

  it("clamps an overlong targetModuleKey to 64 characters", () => {
    expect(
      parseReviewsSearchParams({ targetModuleKey: "x".repeat(100) }).targetModuleKey,
    ).toHaveLength(64);
  });

  it("clamps an overlong search term to 500 characters", () => {
    expect(parseReviewsSearchParams({ search: "x".repeat(600) }).search).toHaveLength(500);
  });

  it("takes the first value when a param is duplicated in the URL", () => {
    expect(parseReviewsSearchParams({ status: ["approved", "rejected"] }).status).toBe("approved");
  });
});

describe("buildReviewsHref", () => {
  const baseQuery = {
    status: null,
    targetModuleKey: null,
    search: null,
    assignedToMe: true,
    offset: 0,
    pageSize: 20 as const,
  };

  it("returns the bare path when nothing diverges from defaults", () => {
    expect(buildReviewsHref(baseQuery, {})).toBe("/review-and-approval-center");
  });

  it("includes status/targetModuleKey/search and omits offset=0/the default pageSize", () => {
    expect(
      buildReviewsHref(baseQuery, {
        status: "revision_requested",
        targetModuleKey: "persona_library",
        search: "buyer",
      }),
    ).toBe(
      "/review-and-approval-center?status=revision_requested&targetModuleKey=persona_library&search=buyer",
    );
  });

  it("only emits assignedToMe when it's explicitly false — true stays implicit", () => {
    expect(buildReviewsHref(baseQuery, { assignedToMe: false })).toBe(
      "/review-and-approval-center?assignedToMe=false",
    );
    expect(buildReviewsHref({ ...baseQuery, assignedToMe: false }, { assignedToMe: true })).toBe(
      "/review-and-approval-center",
    );
  });

  it("resets offset to 0 when an override other than offset itself is applied", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildReviewsHref(withOffset, { status: "approved" })).toBe(
      "/review-and-approval-center?status=approved",
    );
  });

  it("keeps a nonzero offset when explicitly set", () => {
    expect(buildReviewsHref(baseQuery, { offset: 25 })).toBe(
      "/review-and-approval-center?offset=25",
    );
  });
});

describe("reviewStatusBadge", () => {
  it("maps every ReviewStatus value to a distinct token, with approved healthy and rejected unavailable", () => {
    expect(reviewStatusBadge("approved").token).toBe("healthy");
    expect(reviewStatusBadge("rejected").token).toBe("unavailable");
    expect(reviewStatusBadge("submitted").token).toBe("notConfigured");
    expect(reviewStatusBadge("revision_requested").token).toBe("degraded");
  });
});

describe("moduleDisplayName / sortModulesForPicker", () => {
  it("falls back to the raw name when displayName is null", () => {
    expect(moduleDisplayName(moduleFixture("business_knowledge"))).toBe("business_knowledge");
    expect(
      moduleDisplayName(moduleFixture("business_knowledge", { displayName: "Business Knowledge" })),
    ).toBe("Business Knowledge");
  });

  it("sorts modules alphabetically by display name", () => {
    const modules = [
      moduleFixture("z", { displayName: "Zeta Module" }),
      moduleFixture("a", { displayName: "Alpha Module" }),
      moduleFixture("m", { displayName: "Mid Module" }),
    ];
    expect(sortModulesForPicker(modules).map((m) => m.key)).toEqual(["a", "m", "z"]);
  });
});

describe("REVIEW_DECISION_ACTION_LABEL", () => {
  it("labels every one of the 7 real ReviewDecisionAction values", () => {
    const actions: readonly (keyof typeof REVIEW_DECISION_ACTION_LABEL)[] = [
      "approve",
      "approve_with_notes",
      "request_revision",
      "reject",
      "pause",
      "resume",
      "delegate",
    ];
    actions.forEach((action) => {
      expect(REVIEW_DECISION_ACTION_LABEL[action]).toEqual(expect.any(String));
      expect(REVIEW_DECISION_ACTION_LABEL[action].length).toBeGreaterThan(0);
    });
  });
});

describe("getReviews", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    vi.mocked(cookies).mockResolvedValue({ toString: () => "sid=abc" } as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("throws on a non-OK response instead of silently returning an empty list", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(
      getReviews({
        status: null,
        targetModuleKey: null,
        search: null,
        assignedToMe: true,
        offset: 0,
        pageSize: 20,
      }),
    ).rejects.toThrow(/Failed to load reviews/);
  });

  it("requests one row past the chosen page size, with assignedToMe=true only sent when true", async () => {
    const requestedUrls: string[] = [];
    global.fetch = vi.fn((url: string) => {
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [], correlationId: "test" }),
      } as Response);
    }) as typeof fetch;

    await getReviews({
      status: "approved",
      targetModuleKey: "service_library",
      search: "uptime",
      assignedToMe: true,
      offset: 25,
      pageSize: 20,
    });

    expect(requestedUrls[0]).toBe(
      "https://api.example.com/reviews?status=approved&targetModuleKey=service_library&search=uptime&assignedToMe=true&limit=21&offset=25",
    );
  });

  it("omits assignedToMe from the request entirely when it's false", async () => {
    const requestedUrls: string[] = [];
    global.fetch = vi.fn((url: string) => {
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [], correlationId: "test" }),
      } as Response);
    }) as typeof fetch;

    await getReviews({
      status: null,
      targetModuleKey: null,
      search: null,
      assignedToMe: false,
      offset: 0,
      pageSize: 20,
    });

    expect(requestedUrls[0]).toBe("https://api.example.com/reviews?limit=21&offset=0");
  });

  it("reports hasNextPage: true and trims the extra row when the backend returns one more than the page size", async () => {
    const items = Array.from({ length: 21 }, (_, i) => reviewFixture(`r${i}`));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items, correlationId: "test" }),
    } as Response);

    const result = await getReviews({
      status: null,
      targetModuleKey: null,
      search: null,
      assignedToMe: true,
      offset: 0,
      pageSize: 20,
    });

    expect(result.items).toHaveLength(20);
    expect(result.hasNextPage).toBe(true);
  });
});

describe("getReview", () => {
  const originalFetch = global.fetch;
  const VALID_ID = "11111111-1111-1111-1111-111111111111";

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    vi.mocked(cookies).mockResolvedValue({ toString: () => "sid=abc" } as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns null for a malformed id without ever calling fetch", async () => {
    global.fetch = vi.fn() as typeof fetch;
    expect(await getReview("not-a-uuid")).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns null on a 404", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getReview(VALID_ID)).toBeNull();
  });

  it("throws on a non-404 non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response);
    await expect(getReview(VALID_ID)).rejects.toThrow(/Failed to load review/);
  });

  it("returns the review on a 200", async () => {
    const review = reviewFixture(VALID_ID, { targetLabel: "Q4 Copy" });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: review, correlationId: "test" }),
    } as Response);

    const result = await getReview(VALID_ID);
    expect(result?.id).toBe(VALID_ID);
    expect(result?.targetLabel).toBe("Q4 Copy");
  });
});

describe("getReviewDecisions", () => {
  const originalFetch = global.fetch;
  const VALID_ID = "11111111-1111-1111-1111-111111111111";

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    vi.mocked(cookies).mockResolvedValue({ toString: () => "sid=abc" } as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns an empty array for a malformed id without ever calling fetch", async () => {
    global.fetch = vi.fn() as typeof fetch;
    expect(await getReviewDecisions("not-a-uuid")).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns an empty array on a 404 instead of throwing", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getReviewDecisions(VALID_ID)).toEqual([]);
  });

  it("throws on a non-404 non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(getReviewDecisions(VALID_ID)).rejects.toThrow(/Failed to load review decisions/);
  });

  it("requests the /decisions route and returns the backend's own order unmodified", async () => {
    const requestedUrls: string[] = [];
    const decisions: readonly ReviewDecision[] = [
      {
        id: "d1",
        reviewId: VALID_ID,
        action: "approve",
        actorUserId: "actor-1",
        notes: null,
        delegatedToUserId: null,
        decidedAt: "2026-08-24T01:00:00.000Z",
      },
    ];
    global.fetch = vi.fn((url: string) => {
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: decisions, correlationId: "test" }),
      } as Response);
    }) as typeof fetch;

    const result = await getReviewDecisions(VALID_ID);

    expect(requestedUrls[0]).toBe(`https://api.example.com/reviews/${VALID_ID}/decisions`);
    expect(result).toEqual(decisions);
  });
});

describe("getReviewComments", () => {
  const originalFetch = global.fetch;
  const VALID_ID = "11111111-1111-1111-1111-111111111111";

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    vi.mocked(cookies).mockResolvedValue({ toString: () => "sid=abc" } as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns an empty array for a malformed id without ever calling fetch", async () => {
    global.fetch = vi.fn() as typeof fetch;
    expect(await getReviewComments("not-a-uuid")).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns an empty array on a 404 instead of throwing", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getReviewComments(VALID_ID)).toEqual([]);
  });

  it("throws on a non-404 non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(getReviewComments(VALID_ID)).rejects.toThrow(/Failed to load review comments/);
  });

  it("requests the /comments route and returns the backend's own order unmodified", async () => {
    const requestedUrls: string[] = [];
    const comments: readonly ReviewComment[] = [
      {
        id: "c1",
        reviewId: VALID_ID,
        authorUserId: "actor-1",
        body: "<p>Looks good</p>",
        createdAt: "2026-08-24T01:00:00.000Z",
      },
    ];
    global.fetch = vi.fn((url: string) => {
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: comments, correlationId: "test" }),
      } as Response);
    }) as typeof fetch;

    const result = await getReviewComments(VALID_ID);

    expect(requestedUrls[0]).toBe(`https://api.example.com/reviews/${VALID_ID}/comments`);
    expect(result).toEqual(comments);
  });
});

describe("getModuleRegistry", () => {
  const originalFetch = global.fetch;
  const originalConsoleError = console.error;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    vi.mocked(cookies).mockResolvedValue({ toString: () => "sid=abc" } as never);
    console.error = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    console.error = originalConsoleError;
    vi.restoreAllMocks();
  });

  it("degrades to an empty array on a non-OK response (e.g. a 403 for a caller lacking users_roles:view) instead of throwing", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response);
    expect(await getModuleRegistry()).toEqual([]);
  });

  it("degrades to an empty array and logs on a network error, instead of throwing", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down"));
    expect(await getModuleRegistry()).toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });

  it("returns the module list on a 200", async () => {
    const modules = [moduleFixture("service_library")];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: modules, correlationId: "test" }),
    } as Response);

    expect(await getModuleRegistry()).toEqual(modules);
  });
});
