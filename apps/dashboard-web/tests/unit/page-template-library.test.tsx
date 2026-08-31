import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import type {
  ComponentRecord,
  PageTemplateRecord,
  SectionPatternRecord,
} from "@webdesk/shared-types";
import {
  buildPageTemplateLibraryHref,
  getComponentsForPageTemplatePicker,
  getPageTemplate,
  getPageTemplates,
  getPageTemplatesForReplacementPicker,
  getPageTemplateVersions,
  getSectionPatternsForPageTemplatePicker,
  pageTemplateApprovalStatusBadge,
  parsePageTemplateLibrarySearchParams,
} from "../../lib/page-template-library.js";

function pageTemplateFixture(
  id: string,
  overrides: Partial<PageTemplateRecord> = {},
): PageTemplateRecord {
  return {
    id,
    recordId: id,
    publicId: `PGT-${id}`,
    pageType: "homepage",
    versionNumber: 1,
    isCurrent: true,
    name: "Homepage Template",
    requiredSectionIds: [],
    optionalSectionIds: [],
    supportedComponentIds: [],
    wireframeReferences: [],
    contentRequirements: null,
    searchRequirements: null,
    conversionGoal: null,
    phpTemplateRelationship: null,
    replacementRecordId: null,
    approvalStatus: "draft",
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-31T00:00:00.000Z",
    updatedAt: "2026-08-31T00:00:00.000Z",
    ...overrides,
  };
}

function sectionFixture(id: string): SectionPatternRecord {
  return {
    id,
    recordId: id,
    publicId: `SPL-${id}`,
    patternType: "homepage_storytelling",
    versionNumber: 1,
    isCurrent: true,
    name: "Homepage Hero",
    description: null,
    designReference: null,
    htmlStructure: null,
    phpPath: null,
    scssReference: null,
    jsDependencies: [],
    responsiveBehavior: null,
    accessibilityNotes: null,
    browserSupport: null,
    tokenReferences: [],
    relatedComponentIds: [],
    approvalStatus: "draft",
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-31T00:00:00.000Z",
    updatedAt: "2026-08-31T00:00:00.000Z",
  };
}

function componentFixture(id: string): ComponentRecord {
  return {
    id,
    recordId: id,
    publicId: `CL-${id}`,
    category: "buttons",
    versionNumber: 1,
    isCurrent: true,
    name: "Primary Button",
    figmaReference: null,
    tokenIds: [],
    htmlStructure: null,
    phpPath: null,
    scssClassesPath: null,
    jsDependencies: null,
    states: null,
    responsiveBehavior: null,
    browserSupport: null,
    accessibility: null,
    schema: null,
    analytics: null,
    tests: null,
    replacementRecordId: null,
    approvalStatus: "draft",
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-31T00:00:00.000Z",
    updatedAt: "2026-08-31T00:00:00.000Z",
  };
}

describe("parsePageTemplateLibrarySearchParams", () => {
  it("defaults to no filters, offset 0, pageSize 20 when nothing is provided", () => {
    expect(parsePageTemplateLibrarySearchParams({})).toEqual({
      pageType: null,
      approvalStatus: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("parses valid pageType/approvalStatus/search/offset/pageSize values", () => {
    expect(
      parsePageTemplateLibrarySearchParams({
        pageType: "service",
        approvalStatus: "under_review",
        search: "homepage",
        offset: "25",
        pageSize: "50",
      }),
    ).toEqual({
      pageType: "service",
      approvalStatus: "under_review",
      search: "homepage",
      offset: 25,
      pageSize: 50,
    });
  });

  it("falls back to defaults for an invalid/garbled pageType/approvalStatus instead of passing it through", () => {
    expect(
      parsePageTemplateLibrarySearchParams({
        pageType: "not_a_real_type",
        approvalStatus: "not_a_real_status",
        offset: "not-a-number",
      }),
    ).toEqual({
      pageType: null,
      approvalStatus: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("clamps a negative offset to 0", () => {
    expect(parsePageTemplateLibrarySearchParams({ offset: "-10" }).offset).toBe(0);
  });

  it("clamps an overlong search term to 255 characters", () => {
    const overlong = "x".repeat(300);
    expect(parsePageTemplateLibrarySearchParams({ search: overlong }).search).toHaveLength(255);
  });

  it("takes the first value when a param is duplicated in the URL", () => {
    expect(
      parsePageTemplateLibrarySearchParams({ pageType: ["service", "landing"] }).pageType,
    ).toBe("service");
  });
});

describe("buildPageTemplateLibraryHref", () => {
  const baseQuery = {
    pageType: null,
    approvalStatus: null,
    search: null,
    offset: 0,
    pageSize: 20 as const,
  };

  it("returns the bare path when nothing is set", () => {
    expect(buildPageTemplateLibraryHref(baseQuery, {})).toBe("/page-template-library");
  });

  it("includes pageType/approvalStatus/search and omits offset=0/the default pageSize", () => {
    expect(
      buildPageTemplateLibraryHref(baseQuery, {
        pageType: "landing",
        approvalStatus: "draft",
        search: "hero",
      }),
    ).toBe("/page-template-library?pageType=landing&approvalStatus=draft&search=hero");
  });

  it("resets offset to 0 when an override other than offset itself is applied", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildPageTemplateLibraryHref(withOffset, { approvalStatus: "approved" })).toBe(
      "/page-template-library?approvalStatus=approved",
    );
  });

  it("keeps a nonzero offset when explicitly set", () => {
    expect(buildPageTemplateLibraryHref(baseQuery, { offset: 25 })).toBe(
      "/page-template-library?offset=25",
    );
  });
});

describe("pageTemplateApprovalStatusBadge", () => {
  it("maps under_review and revision_requested to the same degraded token, disambiguated by label", () => {
    expect(pageTemplateApprovalStatusBadge("under_review")).toEqual({
      token: "degraded",
      label: "Under Review",
    });
    expect(pageTemplateApprovalStatusBadge("revision_requested")).toEqual({
      token: "degraded",
      label: "Revision Requested",
    });
  });

  it("maps approved to healthy and rejected to unavailable", () => {
    expect(pageTemplateApprovalStatusBadge("approved").token).toBe("healthy");
    expect(pageTemplateApprovalStatusBadge("rejected").token).toBe("unavailable");
  });
});

describe("getPageTemplates", () => {
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
      getPageTemplates({
        pageType: null,
        approvalStatus: null,
        search: null,
        offset: 0,
        pageSize: 20,
      }),
    ).rejects.toThrow(/Failed to load page templates/);
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

    await getPageTemplates({
      pageType: "service",
      approvalStatus: "draft",
      search: "homepage",
      offset: 25,
      pageSize: 20,
    });

    expect(requestedUrls[0]).toBe(
      "https://api.example.com/page-template-library/page-templates?pageType=service&approvalStatus=draft&search=homepage&limit=21&offset=25",
    );
  });

  it("reports hasNextPage: true and trims the extra row when the backend returns one more than the page size", async () => {
    const items = Array.from({ length: 21 }, (_, i) => pageTemplateFixture(`p${i}`));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items, correlationId: "test" }),
    } as Response);

    const result = await getPageTemplates({
      pageType: null,
      approvalStatus: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });

    expect(result.items).toHaveLength(20);
    expect(result.hasNextPage).toBe(true);
  });
});

describe("getPageTemplate", () => {
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
    expect(await getPageTemplate("not-a-uuid")).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns null on a 404", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getPageTemplate(VALID_ID)).toBeNull();
  });

  it("throws on a non-404 non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response);
    await expect(getPageTemplate(VALID_ID)).rejects.toThrow(/Failed to load page template/);
  });

  it("returns the page template on a 200", async () => {
    const pageTemplate = pageTemplateFixture(VALID_ID, { name: "Service Template" });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: pageTemplate, correlationId: "test" }),
    } as Response);

    const result = await getPageTemplate(VALID_ID);
    expect(result?.id).toBe(VALID_ID);
    expect(result?.name).toBe("Service Template");
  });
});

describe("getPageTemplateVersions", () => {
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
    expect(await getPageTemplateVersions("not-a-uuid")).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns an empty array on a 404 instead of throwing", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getPageTemplateVersions(VALID_ID)).toEqual([]);
  });

  it("throws on a non-404 non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(getPageTemplateVersions(VALID_ID)).rejects.toThrow(
      /Failed to load page template versions/,
    );
  });

  it("requests the /versions route and returns every version, oldest first (the backend's own order, unmodified)", async () => {
    const requestedUrls: string[] = [];
    const versions = [
      pageTemplateFixture("v1", { versionNumber: 1 }),
      pageTemplateFixture("v2", { versionNumber: 2 }),
    ];
    global.fetch = vi.fn((url: string) => {
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: versions, correlationId: "test" }),
      } as Response);
    }) as typeof fetch;

    const result = await getPageTemplateVersions(VALID_ID);

    expect(requestedUrls[0]).toBe(
      `https://api.example.com/page-template-library/page-templates/${VALID_ID}/versions`,
    );
    expect(result.map((v) => v.versionNumber)).toEqual([1, 2]);
  });
});

describe("getSectionPatternsForPageTemplatePicker", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    vi.mocked(cookies).mockResolvedValue({ toString: () => "sid=abc" } as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("requests section/pattern records at the largest real page size (100), with no filters applied", async () => {
    const requestedUrls: string[] = [];
    global.fetch = vi.fn((url: string) => {
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [], correlationId: "test" }),
      } as Response);
    }) as typeof fetch;

    await getSectionPatternsForPageTemplatePicker();

    expect(requestedUrls[0]).toBe(
      "https://api.example.com/section-and-pattern-library/records?limit=101&offset=0",
    );
  });

  it("returns the fetched section/pattern records, trimmed to the page size", async () => {
    const items = [sectionFixture("s1"), sectionFixture("s2")];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items, correlationId: "test" }),
    } as Response);

    expect(await getSectionPatternsForPageTemplatePicker()).toEqual(items);
  });

  it("degrades to an empty list instead of throwing when the fetch fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);

    await expect(getSectionPatternsForPageTemplatePicker()).resolves.toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  });
});

describe("getComponentsForPageTemplatePicker", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    vi.mocked(cookies).mockResolvedValue({ toString: () => "sid=abc" } as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("requests components at the largest real page size (100), with no filters applied", async () => {
    const requestedUrls: string[] = [];
    global.fetch = vi.fn((url: string) => {
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [], correlationId: "test" }),
      } as Response);
    }) as typeof fetch;

    await getComponentsForPageTemplatePicker();

    expect(requestedUrls[0]).toBe(
      "https://api.example.com/component-library/components?limit=101&offset=0",
    );
  });

  it("returns the fetched components, trimmed to the page size", async () => {
    const items = [componentFixture("c1"), componentFixture("c2")];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items, correlationId: "test" }),
    } as Response);

    expect(await getComponentsForPageTemplatePicker()).toEqual(items);
  });

  it("degrades to an empty list instead of throwing on a network error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = vi.fn().mockRejectedValue(new Error("network error"));

    await expect(getComponentsForPageTemplatePicker()).resolves.toEqual([]);
  });
});

describe("getPageTemplatesForReplacementPicker", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    vi.mocked(cookies).mockResolvedValue({ toString: () => "sid=abc" } as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("requests page templates at the largest real page size (100), with no filters applied", async () => {
    const requestedUrls: string[] = [];
    global.fetch = vi.fn((url: string) => {
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [], correlationId: "test" }),
      } as Response);
    }) as typeof fetch;

    await getPageTemplatesForReplacementPicker();

    expect(requestedUrls[0]).toBe(
      "https://api.example.com/page-template-library/page-templates?limit=101&offset=0",
    );
  });

  it("returns the fetched page templates, trimmed to the page size", async () => {
    const items = [pageTemplateFixture("p1"), pageTemplateFixture("p2")];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items, correlationId: "test" }),
    } as Response);

    expect(await getPageTemplatesForReplacementPicker()).toEqual(items);
  });

  it("degrades to an empty list instead of throwing when the fetch fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);

    await expect(getPageTemplatesForReplacementPicker()).resolves.toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  });
});
