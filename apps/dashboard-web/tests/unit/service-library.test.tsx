import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import type { Service } from "@webdesk/shared-types";
import {
  buildServiceLibraryHref,
  getService,
  getServiceCategories,
  getServices,
  parseServiceLibrarySearchParams,
  serviceApprovalStatusBadge,
  servicePublicationStatusBadge,
} from "../../lib/service-library.js";

describe("parseServiceLibrarySearchParams", () => {
  it("defaults to no filters, offset 0, pageSize 20 when nothing is provided", () => {
    expect(parseServiceLibrarySearchParams({})).toEqual({
      categoryId: null,
      approvalStatus: null,
      publicationStatus: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("parses valid categoryId/approvalStatus/publicationStatus/search/offset/pageSize values", () => {
    expect(
      parseServiceLibrarySearchParams({
        categoryId: "11111111-1111-1111-1111-111111111111",
        approvalStatus: "under_review",
        publicationStatus: "published",
        search: "commerce",
        offset: "25",
        pageSize: "50",
      }),
    ).toEqual({
      categoryId: "11111111-1111-1111-1111-111111111111",
      approvalStatus: "under_review",
      publicationStatus: "published",
      search: "commerce",
      offset: 25,
      pageSize: 50,
    });
  });

  it("falls back to defaults for invalid/garbled enum values instead of passing them through", () => {
    expect(
      parseServiceLibrarySearchParams({
        approvalStatus: "not_a_real_status",
        publicationStatus: "deleted",
        offset: "not-a-number",
        pageSize: "37",
      }),
    ).toEqual({
      categoryId: null,
      approvalStatus: null,
      publicationStatus: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("clamps a negative offset to 0", () => {
    expect(parseServiceLibrarySearchParams({ offset: "-10" }).offset).toBe(0);
  });

  it("clamps an overlong search term to 255 characters", () => {
    const overlong = "x".repeat(300);
    expect(parseServiceLibrarySearchParams({ search: overlong }).search).toHaveLength(255);
  });

  it("takes the first value when a param is duplicated in the URL", () => {
    expect(
      parseServiceLibrarySearchParams({ approvalStatus: ["draft", "approved"] }).approvalStatus,
    ).toBe("draft");
  });
});

describe("buildServiceLibraryHref", () => {
  const baseQuery = {
    categoryId: null,
    approvalStatus: null,
    publicationStatus: null,
    search: null,
    offset: 0,
    pageSize: 20 as const,
  };

  it("returns the bare path when nothing is set", () => {
    expect(buildServiceLibraryHref(baseQuery, {})).toBe("/service-library");
  });

  it("includes approvalStatus/publicationStatus/search and omits offset=0/the default pageSize", () => {
    expect(
      buildServiceLibraryHref(baseQuery, { approvalStatus: "draft", search: "commerce" }),
    ).toBe("/service-library?approvalStatus=draft&search=commerce");
  });

  it("resets offset to 0 when an override other than offset itself is applied", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildServiceLibraryHref(withOffset, { publicationStatus: "published" })).toBe(
      "/service-library?publicationStatus=published",
    );
  });

  it("keeps a nonzero offset when explicitly set", () => {
    expect(buildServiceLibraryHref(baseQuery, { offset: 25 })).toBe("/service-library?offset=25");
  });

  it("includes a non-default pageSize and resets offset to 0", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildServiceLibraryHref(withOffset, { pageSize: 50 })).toBe(
      "/service-library?pageSize=50",
    );
  });
});

describe("serviceApprovalStatusBadge", () => {
  it("maps under_review and revision_requested to the same degraded token, disambiguated by label", () => {
    expect(serviceApprovalStatusBadge("under_review")).toEqual({
      token: "degraded",
      label: "Under Review",
    });
    expect(serviceApprovalStatusBadge("revision_requested")).toEqual({
      token: "degraded",
      label: "Revision Requested",
    });
  });

  it("maps approved to healthy and rejected to unavailable", () => {
    expect(serviceApprovalStatusBadge("approved").token).toBe("healthy");
    expect(serviceApprovalStatusBadge("rejected").token).toBe("unavailable");
  });
});

describe("servicePublicationStatusBadge", () => {
  it("maps published to healthy and unpublished to notConfigured", () => {
    expect(servicePublicationStatusBadge("published").token).toBe("healthy");
    expect(servicePublicationStatusBadge("unpublished").token).toBe("notConfigured");
  });
});

function serviceFixture(id: string, overrides: Partial<Service> = {}): Service {
  return {
    id,
    publicId: `SVC-${id}`,
    canonicalName: "Headless Commerce",
    publicName: null,
    categoryId: "cat-1",
    parentServiceId: null,
    shortPublicDescription: null,
    audience: null,
    problems: null,
    capabilities: null,
    outcomes: null,
    exclusions: null,
    internalDescription: null,
    icpIds: [],
    relatedPageIds: [],
    relatedCaseStudyIds: [],
    confidentiality: "internal",
    publicationStatus: "draft",
    approvalStatus: "draft",
    ownerUserId: null,
    createdAt: "2026-08-21T00:00:00.000Z",
    updatedAt: "2026-08-21T00:00:00.000Z",
    ...overrides,
  };
}

describe("getServices", () => {
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
      getServices({
        categoryId: null,
        approvalStatus: null,
        publicationStatus: null,
        search: null,
        offset: 0,
        pageSize: 20,
      }),
    ).rejects.toThrow(/Failed to load services/);
  });

  it("requests one row past the chosen page size, to detect a real next page", async () => {
    const requestedUrls: string[] = [];
    global.fetch = vi.fn((url: string) => {
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [], correlationId: "test" }),
      } as Response);
    }) as typeof fetch;

    await getServices({
      categoryId: "cat-1",
      approvalStatus: "draft",
      publicationStatus: null,
      search: "commerce",
      offset: 25,
      pageSize: 20,
    });

    expect(requestedUrls[0]).toBe(
      "https://api.example.com/service-library/services?categoryId=cat-1&approvalStatus=draft&search=commerce&limit=21&offset=25",
    );
  });

  it("reports hasNextPage: true and trims the extra row when the backend returns one more than the page size", async () => {
    const items = Array.from({ length: 21 }, (_, i) => serviceFixture(`s${i}`));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items, correlationId: "test" }),
    } as Response);

    const result = await getServices({
      categoryId: null,
      approvalStatus: null,
      publicationStatus: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });

    expect(result.items).toHaveLength(20);
    expect(result.hasNextPage).toBe(true);
  });
});

describe("getService", () => {
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
    const result = await getService("not-a-uuid");
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns null on a 404", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getService(VALID_ID)).toBeNull();
  });

  it("throws on a non-404 non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response);
    await expect(getService(VALID_ID)).rejects.toThrow(/Failed to load service/);
  });

  it("returns the enriched detail shape, including a redacted internalDescription (absent, not null)", async () => {
    const redacted = {
      ...serviceFixture(VALID_ID, { confidentiality: "restricted" }),
      internalDescription: undefined,
      deliverableIds: [],
      platformIds: [],
      engagementModelIds: [],
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: redacted, correlationId: "test" }),
    } as Response);

    const result = await getService(VALID_ID);
    expect(result?.id).toBe(VALID_ID);
    expect(result?.internalDescription).toBeUndefined();
    expect(result?.deliverableIds).toEqual([]);
  });
});

describe("getServiceCategories", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    vi.mocked(cookies).mockResolvedValue({ toString: () => "sid=abc" } as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("throws on a non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(getServiceCategories()).rejects.toThrow(/Failed to load categories/);
  });

  it("returns the full category list on a 200", async () => {
    const categories = [
      { id: "cat-1", publicId: "CAT-1", name: "E-Commerce", parentCategoryId: null },
    ];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: categories, correlationId: "test" }),
    } as Response);

    expect(await getServiceCategories()).toEqual(categories);
  });
});
