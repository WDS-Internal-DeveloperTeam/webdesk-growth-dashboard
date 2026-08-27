import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import type { BrandLibraryRecord } from "@webdesk/shared-types";
import {
  brandLibraryApprovalStatusBadge,
  brandLibraryPublishBadge,
  buildBrandLibraryHref,
  getBrandLibraryRecord,
  getBrandLibraryRecords,
  parseBrandLibrarySearchParams,
} from "../../lib/brand-library.js";

describe("parseBrandLibrarySearchParams", () => {
  it("defaults to no filters, offset 0, pageSize 20 when nothing is provided", () => {
    expect(parseBrandLibrarySearchParams({})).toEqual({
      recordType: null,
      approvalStatus: null,
      isPublished: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("parses valid recordType/approvalStatus/isPublished/search/offset/pageSize values", () => {
    expect(
      parseBrandLibrarySearchParams({
        recordType: "logo",
        approvalStatus: "under_review",
        isPublished: "true",
        search: "wordmark",
        offset: "25",
        pageSize: "50",
      }),
    ).toEqual({
      recordType: "logo",
      approvalStatus: "under_review",
      isPublished: true,
      search: "wordmark",
      offset: 25,
      pageSize: 50,
    });
  });

  it("parses isPublished=false as literal false, not falling through to null", () => {
    expect(parseBrandLibrarySearchParams({ isPublished: "false" }).isPublished).toBe(false);
  });

  it("falls back to defaults for invalid/garbled enum values instead of passing them through", () => {
    expect(
      parseBrandLibrarySearchParams({
        recordType: "not_a_real_type",
        approvalStatus: "not_a_real_status",
        isPublished: "maybe",
        offset: "not-a-number",
        pageSize: "37",
      }),
    ).toEqual({
      recordType: null,
      approvalStatus: null,
      isPublished: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("clamps a negative offset to 0", () => {
    expect(parseBrandLibrarySearchParams({ offset: "-10" }).offset).toBe(0);
  });

  it("clamps an overlong search term to 255 characters", () => {
    const overlong = "x".repeat(300);
    expect(parseBrandLibrarySearchParams({ search: overlong }).search).toHaveLength(255);
  });

  it("takes the first value when a param is duplicated in the URL", () => {
    expect(parseBrandLibrarySearchParams({ recordType: ["logo", "color"] }).recordType).toBe(
      "logo",
    );
  });
});

describe("buildBrandLibraryHref", () => {
  const baseQuery = {
    recordType: null,
    approvalStatus: null,
    isPublished: null,
    search: null,
    offset: 0,
    pageSize: 20 as const,
  };

  it("returns the bare path when nothing is set", () => {
    expect(buildBrandLibraryHref(baseQuery, {})).toBe("/brand-library");
  });

  it("includes recordType/approvalStatus/isPublished/search and omits offset=0/the default pageSize", () => {
    expect(
      buildBrandLibraryHref(baseQuery, {
        recordType: "logo",
        approvalStatus: "draft",
        isPublished: true,
        search: "mark",
      }),
    ).toBe("/brand-library?recordType=logo&approvalStatus=draft&isPublished=true&search=mark");
  });

  it("includes isPublished=false explicitly rather than omitting it", () => {
    expect(buildBrandLibraryHref(baseQuery, { isPublished: false })).toBe(
      "/brand-library?isPublished=false",
    );
  });

  it("resets offset to 0 when an override other than offset itself is applied", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildBrandLibraryHref(withOffset, { approvalStatus: "approved" })).toBe(
      "/brand-library?approvalStatus=approved",
    );
  });

  it("keeps a nonzero offset when explicitly set", () => {
    expect(buildBrandLibraryHref(baseQuery, { offset: 25 })).toBe("/brand-library?offset=25");
  });

  it("includes a non-default pageSize and resets offset to 0", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildBrandLibraryHref(withOffset, { pageSize: 50 })).toBe("/brand-library?pageSize=50");
  });
});

describe("brandLibraryApprovalStatusBadge", () => {
  it("maps under_review and revision_requested to the same degraded token, disambiguated by label", () => {
    expect(brandLibraryApprovalStatusBadge("under_review")).toEqual({
      token: "degraded",
      label: "Under Review",
    });
    expect(brandLibraryApprovalStatusBadge("revision_requested")).toEqual({
      token: "degraded",
      label: "Revision Requested",
    });
  });

  it("maps approved to healthy and rejected to unavailable", () => {
    expect(brandLibraryApprovalStatusBadge("approved").token).toBe("healthy");
    expect(brandLibraryApprovalStatusBadge("rejected").token).toBe("unavailable");
  });
});

describe("brandLibraryPublishBadge", () => {
  it("maps published to healthy and unpublished to notConfigured — notConfigured, not unknown, so 'Unpublished' doesn't collide with 'Draft'", () => {
    expect(brandLibraryPublishBadge(true)).toEqual({ token: "healthy", label: "Published" });
    expect(brandLibraryPublishBadge(false)).toEqual({
      token: "notConfigured",
      label: "Unpublished",
    });
  });
});

function recordFixture(
  id: string,
  overrides: Partial<BrandLibraryRecord> = {},
): BrandLibraryRecord {
  return {
    id,
    publicId: `BRAND-${id}`,
    recordType: "logo",
    title: "Primary logo",
    description: null,
    fileReference: null,
    usageNotes: null,
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

describe("getBrandLibraryRecords", () => {
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
      getBrandLibraryRecords({
        recordType: null,
        approvalStatus: null,
        isPublished: null,
        search: null,
        offset: 0,
        pageSize: 20,
      }),
    ).rejects.toThrow(/Failed to load brand library records/);
  });

  it("requests one row past the chosen page size, to detect a real next page, including recordType/isPublished", async () => {
    const requestedUrls: string[] = [];
    global.fetch = vi.fn((url: string) => {
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [], correlationId: "test" }),
      } as Response);
    }) as typeof fetch;

    await getBrandLibraryRecords({
      recordType: "logo",
      approvalStatus: "draft",
      isPublished: true,
      search: "mark",
      offset: 25,
      pageSize: 20,
    });

    expect(requestedUrls[0]).toBe(
      "https://api.example.com/brand-library/records?recordType=logo&approvalStatus=draft&isPublished=true&search=mark&limit=21&offset=25",
    );
  });

  it("reports hasNextPage: true and trims the extra row when the backend returns one more than the page size", async () => {
    const items = Array.from({ length: 21 }, (_, i) => recordFixture(`r${i}`));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items, correlationId: "test" }),
    } as Response);

    const result = await getBrandLibraryRecords({
      recordType: null,
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

describe("getBrandLibraryRecord", () => {
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
    const result = await getBrandLibraryRecord("not-a-uuid");
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns null on a 404", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getBrandLibraryRecord(VALID_ID)).toBeNull();
  });

  it("throws on a non-404 non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response);
    await expect(getBrandLibraryRecord(VALID_ID)).rejects.toThrow(
      /Failed to load brand library record/,
    );
  });

  it("returns the brand library record on a 200", async () => {
    const record = recordFixture(VALID_ID, { fileReference: "https://cdn.example.com/logo.svg" });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: record, correlationId: "test" }),
    } as Response);

    const result = await getBrandLibraryRecord(VALID_ID);
    expect(result?.id).toBe(VALID_ID);
    expect(result?.fileReference).toBe("https://cdn.example.com/logo.svg");
  });
});
