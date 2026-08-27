import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import type { DesignReferenceRecord } from "@webdesk/shared-types";
import {
  buildDesignReferenceLibraryHref,
  designReferenceApprovalStatusBadge,
  designReferencePublishBadge,
  getDesignReferenceRecord,
  getDesignReferenceRecords,
  parseDesignReferenceLibrarySearchParams,
} from "../../lib/design-reference-library.js";

describe("parseDesignReferenceLibrarySearchParams", () => {
  it("defaults to no filters, offset 0, pageSize 20 when nothing is provided", () => {
    expect(parseDesignReferenceLibrarySearchParams({})).toEqual({
      approvalStatus: null,
      isPublished: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("parses valid approvalStatus/isPublished/search/offset/pageSize values", () => {
    expect(
      parseDesignReferenceLibrarySearchParams({
        approvalStatus: "under_review",
        isPublished: "true",
        search: "hero",
        offset: "25",
        pageSize: "50",
      }),
    ).toEqual({
      approvalStatus: "under_review",
      isPublished: true,
      search: "hero",
      offset: 25,
      pageSize: 50,
    });
  });

  it("parses isPublished=false as literal false, not falling through to null", () => {
    expect(parseDesignReferenceLibrarySearchParams({ isPublished: "false" }).isPublished).toBe(
      false,
    );
  });

  it("falls back to defaults for invalid/garbled enum values instead of passing them through", () => {
    expect(
      parseDesignReferenceLibrarySearchParams({
        approvalStatus: "not_a_real_status",
        isPublished: "maybe",
        offset: "not-a-number",
        pageSize: "37",
      }),
    ).toEqual({
      approvalStatus: null,
      isPublished: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("clamps a negative offset to 0", () => {
    expect(parseDesignReferenceLibrarySearchParams({ offset: "-10" }).offset).toBe(0);
  });

  it("clamps an overlong search term to 255 characters", () => {
    const overlong = "x".repeat(300);
    expect(parseDesignReferenceLibrarySearchParams({ search: overlong }).search).toHaveLength(255);
  });

  it("takes the first value when a param is duplicated in the URL", () => {
    expect(
      parseDesignReferenceLibrarySearchParams({ approvalStatus: ["draft", "approved"] })
        .approvalStatus,
    ).toBe("draft");
  });
});

describe("buildDesignReferenceLibraryHref", () => {
  const baseQuery = {
    approvalStatus: null,
    isPublished: null,
    search: null,
    offset: 0,
    pageSize: 20 as const,
  };

  it("returns the bare path when nothing is set", () => {
    expect(buildDesignReferenceLibraryHref(baseQuery, {})).toBe("/design-reference-library");
  });

  it("includes approvalStatus/isPublished/search and omits offset=0/the default pageSize", () => {
    expect(
      buildDesignReferenceLibraryHref(baseQuery, {
        approvalStatus: "draft",
        isPublished: true,
        search: "hero",
      }),
    ).toBe("/design-reference-library?approvalStatus=draft&isPublished=true&search=hero");
  });

  it("includes isPublished=false explicitly rather than omitting it", () => {
    expect(buildDesignReferenceLibraryHref(baseQuery, { isPublished: false })).toBe(
      "/design-reference-library?isPublished=false",
    );
  });

  it("resets offset to 0 when an override other than offset itself is applied", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildDesignReferenceLibraryHref(withOffset, { approvalStatus: "approved" })).toBe(
      "/design-reference-library?approvalStatus=approved",
    );
  });

  it("keeps a nonzero offset when explicitly set", () => {
    expect(buildDesignReferenceLibraryHref(baseQuery, { offset: 25 })).toBe(
      "/design-reference-library?offset=25",
    );
  });

  it("includes a non-default pageSize and resets offset to 0", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildDesignReferenceLibraryHref(withOffset, { pageSize: 50 })).toBe(
      "/design-reference-library?pageSize=50",
    );
  });
});

describe("designReferenceApprovalStatusBadge", () => {
  it("maps under_review and revision_requested to the same degraded token, disambiguated by label", () => {
    expect(designReferenceApprovalStatusBadge("under_review")).toEqual({
      token: "degraded",
      label: "Under Review",
    });
    expect(designReferenceApprovalStatusBadge("revision_requested")).toEqual({
      token: "degraded",
      label: "Revision Requested",
    });
  });

  it("maps approved to healthy and rejected to unavailable", () => {
    expect(designReferenceApprovalStatusBadge("approved").token).toBe("healthy");
    expect(designReferenceApprovalStatusBadge("rejected").token).toBe("unavailable");
  });
});

describe("designReferencePublishBadge", () => {
  it("maps published to healthy and unpublished to notConfigured — notConfigured, not unknown, so 'Unpublished' doesn't collide with 'Draft'", () => {
    expect(designReferencePublishBadge(true)).toEqual({ token: "healthy", label: "Published" });
    expect(designReferencePublishBadge(false)).toEqual({
      token: "notConfigured",
      label: "Unpublished",
    });
  });
});

function recordFixture(
  id: string,
  overrides: Partial<DesignReferenceRecord> = {},
): DesignReferenceRecord {
  return {
    id,
    publicId: `DRL-${id}`,
    title: "Homepage hero",
    sourceUrl: null,
    screenshotUrl: null,
    pageSectionType: null,
    likes: null,
    dislikes: null,
    desktopBehavior: null,
    mobileBehavior: null,
    motionNotes: null,
    accessibilityConcerns: null,
    performanceConcerns: null,
    tags: [],
    approvalStatus: "draft",
    version: 1,
    isPublished: false,
    publishedAt: null,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-27T00:00:00.000Z",
    updatedAt: "2026-08-27T00:00:00.000Z",
    ...overrides,
  };
}

describe("getDesignReferenceRecords", () => {
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
      getDesignReferenceRecords({
        approvalStatus: null,
        isPublished: null,
        search: null,
        offset: 0,
        pageSize: 20,
      }),
    ).rejects.toThrow(/Failed to load design reference records/);
  });

  it("requests one row past the chosen page size, to detect a real next page, including approvalStatus/isPublished", async () => {
    const requestedUrls: string[] = [];
    global.fetch = vi.fn((url: string) => {
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [], correlationId: "test" }),
      } as Response);
    }) as typeof fetch;

    await getDesignReferenceRecords({
      approvalStatus: "draft",
      isPublished: true,
      search: "hero",
      offset: 25,
      pageSize: 20,
    });

    expect(requestedUrls[0]).toBe(
      "https://api.example.com/design-reference-library/records?approvalStatus=draft&isPublished=true&search=hero&limit=21&offset=25",
    );
  });

  it("reports hasNextPage: true and trims the extra row when the backend returns one more than the page size", async () => {
    const items = Array.from({ length: 21 }, (_, i) => recordFixture(`r${i}`));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items, correlationId: "test" }),
    } as Response);

    const result = await getDesignReferenceRecords({
      approvalStatus: null,
      isPublished: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });

    expect(result.items).toHaveLength(20);
    expect(result.hasNextPage).toBe(true);
  });
});

describe("getDesignReferenceRecord", () => {
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
    const result = await getDesignReferenceRecord("not-a-uuid");
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns null on a 404", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getDesignReferenceRecord(VALID_ID)).toBeNull();
  });

  it("throws on a non-404 non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response);
    await expect(getDesignReferenceRecord(VALID_ID)).rejects.toThrow(
      /Failed to load design reference record/,
    );
  });

  it("returns the design reference record on a 200", async () => {
    const record = recordFixture(VALID_ID, {
      sourceUrl: "https://example.com/pricing",
      screenshotUrl: "https://cdn.example.com/shot.png",
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: record, correlationId: "test" }),
    } as Response);

    const result = await getDesignReferenceRecord(VALID_ID);
    expect(result?.id).toBe(VALID_ID);
    expect(result?.sourceUrl).toBe("https://example.com/pricing");
    expect(result?.screenshotUrl).toBe("https://cdn.example.com/shot.png");
  });
});
