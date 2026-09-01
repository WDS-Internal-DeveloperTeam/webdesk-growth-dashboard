import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import type { DesignReview, DesignReviewDecision } from "@webdesk/shared-types";
import {
  buildDesignReviewsHref,
  DESIGN_REVIEW_DECISION_ACTION_LABEL,
  DESIGN_REVIEW_TYPE_VALUES,
  designReviewStatusBadge,
  getDesignReview,
  getDesignReviewDecisions,
  getDesignReviews,
  parseDesignReviewsSearchParams,
} from "../../lib/design-review-center.js";

function designReviewFixture(id: string, overrides: Partial<DesignReview> = {}): DesignReview {
  return {
    id,
    targetModuleKey: "component_library",
    targetId: "22222222-2222-2222-2222-222222222222",
    targetLabel: null,
    reviewType: "ui",
    status: "submitted",
    submittedByUserId: "33333333-3333-3333-3333-333333333333",
    assignedToUserId: null,
    decidedByUserId: null,
    decidedAt: null,
    versionALabel: null,
    versionBLabel: null,
    createdAt: "2026-08-31T00:00:00.000Z",
    updatedAt: "2026-08-31T00:00:00.000Z",
    ...overrides,
  };
}

describe("parseDesignReviewsSearchParams", () => {
  it("defaults to assignedToMe: true (the inbox view), no filters, offset 0, pageSize 20 when nothing is provided", () => {
    expect(parseDesignReviewsSearchParams({})).toEqual({
      status: null,
      targetModuleKey: null,
      reviewType: null,
      search: null,
      assignedToMe: true,
      offset: 0,
      pageSize: 20,
    });
  });

  it("parses valid status/targetModuleKey/reviewType/search/offset/pageSize values", () => {
    expect(
      parseDesignReviewsSearchParams({
        status: "approved",
        targetModuleKey: "component_library",
        reviewType: "accessibility_by_design",
        search: "hero",
        offset: "25",
        pageSize: "50",
      }),
    ).toEqual({
      status: "approved",
      targetModuleKey: "component_library",
      reviewType: "accessibility_by_design",
      search: "hero",
      assignedToMe: true,
      offset: 25,
      pageSize: 50,
    });
  });

  it("only an explicit assignedToMe=false switches off the default inbox view", () => {
    expect(parseDesignReviewsSearchParams({ assignedToMe: "false" }).assignedToMe).toBe(false);
    expect(parseDesignReviewsSearchParams({ assignedToMe: "true" }).assignedToMe).toBe(true);
    expect(parseDesignReviewsSearchParams({ assignedToMe: "garbage" }).assignedToMe).toBe(true);
  });

  it("falls back to defaults for an invalid/garbled status or reviewType instead of passing it through", () => {
    expect(
      parseDesignReviewsSearchParams({
        status: "not_a_real_status",
        reviewType: "not_a_real_type",
        offset: "not-a-number",
      }),
    ).toEqual({
      status: null,
      targetModuleKey: null,
      reviewType: null,
      search: null,
      assignedToMe: true,
      offset: 0,
      pageSize: 20,
    });
  });

  it("clamps a negative offset to 0", () => {
    expect(parseDesignReviewsSearchParams({ offset: "-10" }).offset).toBe(0);
  });

  it("clamps an overlong targetModuleKey to 64 characters", () => {
    expect(
      parseDesignReviewsSearchParams({ targetModuleKey: "x".repeat(100) }).targetModuleKey,
    ).toHaveLength(64);
  });

  it("clamps an overlong search term to 500 characters", () => {
    expect(parseDesignReviewsSearchParams({ search: "x".repeat(600) }).search).toHaveLength(500);
  });

  it("takes the first value when a param is duplicated in the URL", () => {
    expect(parseDesignReviewsSearchParams({ status: ["approved", "rejected"] }).status).toBe(
      "approved",
    );
  });
});

describe("buildDesignReviewsHref", () => {
  const baseQuery = {
    status: null,
    targetModuleKey: null,
    reviewType: null,
    search: null,
    assignedToMe: true,
    offset: 0,
    pageSize: 20 as const,
  };

  it("returns the bare path when nothing diverges from defaults", () => {
    expect(buildDesignReviewsHref(baseQuery, {})).toBe("/design-review-center");
  });

  it("includes status/targetModuleKey/reviewType/search and omits offset=0/the default pageSize", () => {
    expect(
      buildDesignReviewsHref(baseQuery, {
        status: "revision_requested",
        targetModuleKey: "page_template_library",
        reviewType: "motion",
        search: "hero",
      }),
    ).toBe(
      "/design-review-center?status=revision_requested&targetModuleKey=page_template_library&reviewType=motion&search=hero",
    );
  });

  it("only emits assignedToMe when it's explicitly false — true stays implicit", () => {
    expect(buildDesignReviewsHref(baseQuery, { assignedToMe: false })).toBe(
      "/design-review-center?assignedToMe=false",
    );
    expect(
      buildDesignReviewsHref({ ...baseQuery, assignedToMe: false }, { assignedToMe: true }),
    ).toBe("/design-review-center");
  });

  it("resets offset to 0 when an override other than offset itself is applied", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildDesignReviewsHref(withOffset, { status: "approved" })).toBe(
      "/design-review-center?status=approved",
    );
  });

  it("keeps a nonzero offset when explicitly set", () => {
    expect(buildDesignReviewsHref(baseQuery, { offset: 25 })).toBe(
      "/design-review-center?offset=25",
    );
  });
});

describe("designReviewStatusBadge", () => {
  it("maps every DesignReviewStatus value to a distinct token, approved healthy and rejected/superseded not treated as healthy", () => {
    expect(designReviewStatusBadge("approved").token).toBe("healthy");
    expect(designReviewStatusBadge("rejected").token).toBe("unavailable");
    expect(designReviewStatusBadge("submitted").token).toBe("notConfigured");
    expect(designReviewStatusBadge("revision_requested").token).toBe("degraded");
    expect(designReviewStatusBadge("superseded").token).toBe("notConfigured");
  });
});

describe("DESIGN_REVIEW_TYPE_VALUES", () => {
  it("has all 9 review types from 03_Detailed_Module_Specifications.md §19", () => {
    expect(DESIGN_REVIEW_TYPE_VALUES).toEqual([
      "creative_direction",
      "ux",
      "conversion",
      "ui",
      "accessibility_by_design",
      "responsive_behavior",
      "component_consistency",
      "motion",
      "performance_impact",
    ]);
  });
});

describe("DESIGN_REVIEW_DECISION_ACTION_LABEL", () => {
  it("labels every one of the 5 real DesignReviewDecisionAction values, including the automatic supersede side effect", () => {
    const actions: readonly (keyof typeof DESIGN_REVIEW_DECISION_ACTION_LABEL)[] = [
      "approve",
      "approve_with_notes",
      "request_revision",
      "reject",
      "supersede",
    ];
    actions.forEach((action) => {
      expect(DESIGN_REVIEW_DECISION_ACTION_LABEL[action]).toEqual(expect.any(String));
      expect(DESIGN_REVIEW_DECISION_ACTION_LABEL[action].length).toBeGreaterThan(0);
    });
  });
});

describe("getDesignReviews", () => {
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
      getDesignReviews({
        status: null,
        targetModuleKey: null,
        reviewType: null,
        search: null,
        assignedToMe: true,
        offset: 0,
        pageSize: 20,
      }),
    ).rejects.toThrow(/Failed to load design reviews/);
  });

  it("requests one row past the chosen page size, with reviewType and assignedToMe=true only sent when set", async () => {
    const requestedUrls: string[] = [];
    global.fetch = vi.fn((url: string) => {
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [], correlationId: "test" }),
      } as Response);
    }) as typeof fetch;

    await getDesignReviews({
      status: "approved",
      targetModuleKey: "component_library",
      reviewType: "ux",
      search: "hero",
      assignedToMe: true,
      offset: 25,
      pageSize: 20,
    });

    expect(requestedUrls[0]).toBe(
      "https://api.example.com/design-reviews?status=approved&targetModuleKey=component_library&reviewType=ux&search=hero&assignedToMe=true&limit=21&offset=25",
    );
  });

  it("omits assignedToMe and reviewType from the request entirely when unset", async () => {
    const requestedUrls: string[] = [];
    global.fetch = vi.fn((url: string) => {
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [], correlationId: "test" }),
      } as Response);
    }) as typeof fetch;

    await getDesignReviews({
      status: null,
      targetModuleKey: null,
      reviewType: null,
      search: null,
      assignedToMe: false,
      offset: 0,
      pageSize: 20,
    });

    expect(requestedUrls[0]).toBe("https://api.example.com/design-reviews?limit=21&offset=0");
  });

  it("reports hasNextPage: true and trims the extra row when the backend returns one more than the page size", async () => {
    const items = Array.from({ length: 21 }, (_, i) => designReviewFixture(`r${i}`));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items, correlationId: "test" }),
    } as Response);

    const result = await getDesignReviews({
      status: null,
      targetModuleKey: null,
      reviewType: null,
      search: null,
      assignedToMe: true,
      offset: 0,
      pageSize: 20,
    });

    expect(result.items).toHaveLength(20);
    expect(result.hasNextPage).toBe(true);
  });
});

describe("getDesignReview", () => {
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
    expect(await getDesignReview("not-a-uuid")).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns null on a 404", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getDesignReview(VALID_ID)).toBeNull();
  });

  it("throws on a non-404 non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response);
    await expect(getDesignReview(VALID_ID)).rejects.toThrow(/Failed to load design review/);
  });

  it("returns the review on a 200", async () => {
    const review = designReviewFixture(VALID_ID, { targetLabel: "Hero banner v2" });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: review, correlationId: "test" }),
    } as Response);

    const result = await getDesignReview(VALID_ID);
    expect(result?.id).toBe(VALID_ID);
    expect(result?.targetLabel).toBe("Hero banner v2");
  });
});

describe("getDesignReviewDecisions", () => {
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
    expect(await getDesignReviewDecisions("not-a-uuid")).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns an empty array on a 404 instead of throwing", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getDesignReviewDecisions(VALID_ID)).toEqual([]);
  });

  it("throws on a non-404 non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(getDesignReviewDecisions(VALID_ID)).rejects.toThrow(
      /Failed to load design review decisions/,
    );
  });

  it("requests the /decisions route and returns the backend's own order unmodified", async () => {
    const requestedUrls: string[] = [];
    const decisions: readonly DesignReviewDecision[] = [
      {
        id: "d1",
        reviewId: VALID_ID,
        action: "approve",
        actorUserId: "actor-1",
        notes: null,
        decidedAt: "2026-08-31T01:00:00.000Z",
      },
    ];
    global.fetch = vi.fn((url: string) => {
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: decisions, correlationId: "test" }),
      } as Response);
    }) as typeof fetch;

    const result = await getDesignReviewDecisions(VALID_ID);

    expect(requestedUrls[0]).toBe(`https://api.example.com/design-reviews/${VALID_ID}/decisions`);
    expect(result).toEqual(decisions);
  });
});
