import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import type { ContentTemplate } from "@webdesk/shared-types";
import {
  buildContentTemplateLibraryHref,
  contentTemplateApprovalStatusBadge,
  contentTemplatePublishBadge,
  getContentTemplate,
  getContentTemplates,
  parseContentTemplateLibrarySearchParams,
} from "../../lib/content-template-library.js";

describe("parseContentTemplateLibrarySearchParams", () => {
  it("defaults to no filters, offset 0, pageSize 20 when nothing is provided", () => {
    expect(parseContentTemplateLibrarySearchParams({})).toEqual({
      approvalStatus: null,
      isPublished: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("parses valid approvalStatus/isPublished/search/offset/pageSize values", () => {
    expect(
      parseContentTemplateLibrarySearchParams({
        approvalStatus: "under_review",
        isPublished: "true",
        search: "commerce",
        offset: "25",
        pageSize: "50",
      }),
    ).toEqual({
      approvalStatus: "under_review",
      isPublished: true,
      search: "commerce",
      offset: 25,
      pageSize: 50,
    });
  });

  it("parses isPublished=false as literal false, not falling through to null", () => {
    expect(parseContentTemplateLibrarySearchParams({ isPublished: "false" }).isPublished).toBe(
      false,
    );
  });

  it("falls back to defaults for invalid/garbled enum values instead of passing them through", () => {
    expect(
      parseContentTemplateLibrarySearchParams({
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
    expect(parseContentTemplateLibrarySearchParams({ offset: "-10" }).offset).toBe(0);
  });

  it("clamps an overlong search term to 255 characters", () => {
    const overlong = "x".repeat(300);
    expect(parseContentTemplateLibrarySearchParams({ search: overlong }).search).toHaveLength(255);
  });

  it("takes the first value when a param is duplicated in the URL", () => {
    expect(
      parseContentTemplateLibrarySearchParams({ approvalStatus: ["draft", "approved"] })
        .approvalStatus,
    ).toBe("draft");
  });
});

describe("buildContentTemplateLibraryHref", () => {
  const baseQuery = {
    approvalStatus: null,
    isPublished: null,
    search: null,
    offset: 0,
    pageSize: 20 as const,
  };

  it("returns the bare path when nothing is set", () => {
    expect(buildContentTemplateLibraryHref(baseQuery, {})).toBe("/content-template-library");
  });

  it("includes approvalStatus/isPublished/search and omits offset=0/the default pageSize", () => {
    expect(
      buildContentTemplateLibraryHref(baseQuery, {
        approvalStatus: "draft",
        isPublished: true,
        search: "landing",
      }),
    ).toBe("/content-template-library?approvalStatus=draft&isPublished=true&search=landing");
  });

  it("includes isPublished=false explicitly rather than omitting it", () => {
    expect(buildContentTemplateLibraryHref(baseQuery, { isPublished: false })).toBe(
      "/content-template-library?isPublished=false",
    );
  });

  it("resets offset to 0 when an override other than offset itself is applied", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildContentTemplateLibraryHref(withOffset, { approvalStatus: "approved" })).toBe(
      "/content-template-library?approvalStatus=approved",
    );
  });

  it("keeps a nonzero offset when explicitly set", () => {
    expect(buildContentTemplateLibraryHref(baseQuery, { offset: 25 })).toBe(
      "/content-template-library?offset=25",
    );
  });

  it("includes a non-default pageSize and resets offset to 0", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildContentTemplateLibraryHref(withOffset, { pageSize: 50 })).toBe(
      "/content-template-library?pageSize=50",
    );
  });
});

describe("contentTemplateApprovalStatusBadge", () => {
  it("maps under_review and revision_requested to the same degraded token, disambiguated by label", () => {
    expect(contentTemplateApprovalStatusBadge("under_review")).toEqual({
      token: "degraded",
      label: "Under Review",
    });
    expect(contentTemplateApprovalStatusBadge("revision_requested")).toEqual({
      token: "degraded",
      label: "Revision Requested",
    });
  });

  it("maps approved to healthy and rejected to unavailable", () => {
    expect(contentTemplateApprovalStatusBadge("approved").token).toBe("healthy");
    expect(contentTemplateApprovalStatusBadge("rejected").token).toBe("unavailable");
  });
});

describe("contentTemplatePublishBadge", () => {
  it("maps published to healthy and unpublished to unknown, with distinct tokens", () => {
    expect(contentTemplatePublishBadge(true)).toEqual({ token: "healthy", label: "Published" });
    expect(contentTemplatePublishBadge(false)).toEqual({
      token: "unknown",
      label: "Unpublished",
    });
  });
});

function templateFixture(id: string, overrides: Partial<ContentTemplate> = {}): ContentTemplate {
  return {
    id,
    publicId: `TEMPLATE-${id}`,
    pageType: "Service Page",
    purpose: null,
    requiredSections: null,
    optionalSections: null,
    proofRules: null,
    seoAeoGeoRequirements: null,
    schema: null,
    ctaRules: null,
    contentDepthGuidance: null,
    approvalStatus: "draft",
    version: 1,
    isPublished: false,
    publishedAt: null,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
    ...overrides,
  };
}

describe("getContentTemplates", () => {
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
      getContentTemplates({
        approvalStatus: null,
        isPublished: null,
        search: null,
        offset: 0,
        pageSize: 20,
      }),
    ).rejects.toThrow(/Failed to load content templates/);
  });

  it("requests one row past the chosen page size, to detect a real next page, including isPublished", async () => {
    const requestedUrls: string[] = [];
    global.fetch = vi.fn((url: string) => {
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [], correlationId: "test" }),
      } as Response);
    }) as typeof fetch;

    await getContentTemplates({
      approvalStatus: "draft",
      isPublished: true,
      search: "landing",
      offset: 25,
      pageSize: 20,
    });

    expect(requestedUrls[0]).toBe(
      "https://api.example.com/content-template-library/templates?approvalStatus=draft&isPublished=true&search=landing&limit=21&offset=25",
    );
  });

  it("reports hasNextPage: true and trims the extra row when the backend returns one more than the page size", async () => {
    const items = Array.from({ length: 21 }, (_, i) => templateFixture(`t${i}`));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items, correlationId: "test" }),
    } as Response);

    const result = await getContentTemplates({
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

describe("getContentTemplate", () => {
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
    const result = await getContentTemplate("not-a-uuid");
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns null on a 404", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getContentTemplate(VALID_ID)).toBeNull();
  });

  it("throws on a non-404 non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response);
    await expect(getContentTemplate(VALID_ID)).rejects.toThrow(/Failed to load content template/);
  });

  it("returns the content template on a 200", async () => {
    const template = templateFixture(VALID_ID, { requiredSections: ["Hero"] });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: template, correlationId: "test" }),
    } as Response);

    const result = await getContentTemplate(VALID_ID);
    expect(result?.id).toBe(VALID_ID);
    expect(result?.requiredSections).toEqual(["Hero"]);
  });
});
