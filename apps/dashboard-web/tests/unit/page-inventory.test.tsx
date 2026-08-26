import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import type { Page, PageUrl } from "@webdesk/shared-types";
import {
  buildPageInventoryHref,
  getPage,
  getPages,
  getPageUrls,
  pageWorkflowStageBadge,
  parsePageInventorySearchParams,
} from "../../lib/page-inventory.js";

const PROJECT_ID = "99999999-9999-9999-9999-999999999999";

function pageFixture(id: string, overrides: Partial<Page> = {}): Page {
  return {
    id,
    projectId: PROJECT_ID,
    publicId: `PG-${id}`,
    pageName: "Home",
    pageType: null,
    existingOrProposed: "proposed",
    indexStatus: "unknown",
    template: null,
    roadmapPhaseId: null,
    workflowStage: "draft",
    lifecycleStage: "proposed",
    lifecyclePreviousStage: null,
    targetKeyword: null,
    designVersion: null,
    repositoryFiles: null,
    wordpressPageId: null,
    wordpressPostId: null,
    lastScanAt: null,
    lastDeploymentAt: null,
    classification: null,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-23T00:00:00.000Z",
    updatedAt: "2026-08-23T00:00:00.000Z",
    ...overrides,
  };
}

function pageUrlFixture(id: string, overrides: Partial<PageUrl> = {}): PageUrl {
  return {
    id,
    pageId: "page-1",
    projectId: PROJECT_ID,
    url: "https://example.com/",
    isCanonical: true,
    createdAt: "2026-08-23T00:00:00.000Z",
    updatedAt: "2026-08-23T00:00:00.000Z",
    ...overrides,
  };
}

describe("parsePageInventorySearchParams", () => {
  it("defaults to no filters, offset 0, pageSize 20 when nothing is provided", () => {
    expect(parsePageInventorySearchParams(PROJECT_ID, {})).toEqual({
      projectId: PROJECT_ID,
      pageType: null,
      workflowStage: null,
      indexStatus: null,
      template: null,
      search: null,
      targetKeyword: null,
      roadmapPhaseId: null,
      lastScanBefore: null,
      lastScanAfter: null,
      lastDeploymentBefore: null,
      lastDeploymentAfter: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("parses valid filter/offset/pageSize values, including roadmapPhaseId", () => {
    const roadmapPhaseId = "22222222-2222-2222-2222-222222222222";
    expect(
      parsePageInventorySearchParams(PROJECT_ID, {
        pageType: "landing",
        workflowStage: "under_review",
        indexStatus: "index",
        template: "hero-v2",
        search: "pricing",
        targetKeyword: "buy widgets",
        roadmapPhaseId,
        lastScanBefore: "2026-08-01",
        lastScanAfter: "2026-07-01",
        lastDeploymentBefore: "2026-08-15",
        lastDeploymentAfter: "2026-07-15",
        offset: "25",
        pageSize: "50",
      }),
    ).toEqual({
      projectId: PROJECT_ID,
      pageType: "landing",
      workflowStage: "under_review",
      indexStatus: "index",
      template: "hero-v2",
      search: "pricing",
      targetKeyword: "buy widgets",
      roadmapPhaseId,
      lastScanBefore: "2026-08-01",
      lastScanAfter: "2026-07-01",
      lastDeploymentBefore: "2026-08-15",
      lastDeploymentAfter: "2026-07-15",
      offset: 25,
      pageSize: 50,
    });
  });

  it("falls back to defaults for invalid/garbled enum, date, and roadmapPhaseId values instead of passing them through", () => {
    const result = parsePageInventorySearchParams(PROJECT_ID, {
      workflowStage: "not_a_real_stage",
      indexStatus: "not_a_real_status",
      lastScanBefore: "not-a-date",
      roadmapPhaseId: "not-a-uuid",
      offset: "not-a-number",
      pageSize: "37",
    });
    expect(result.workflowStage).toBeNull();
    expect(result.indexStatus).toBeNull();
    expect(result.lastScanBefore).toBeNull();
    expect(result.roadmapPhaseId).toBeNull();
    expect(result.offset).toBe(0);
    expect(result.pageSize).toBe(20);
  });

  it("clamps a negative offset to 0", () => {
    expect(parsePageInventorySearchParams(PROJECT_ID, { offset: "-10" }).offset).toBe(0);
  });

  it("clamps an overlong search term to 255 characters", () => {
    const overlong = "x".repeat(300);
    expect(parsePageInventorySearchParams(PROJECT_ID, { search: overlong }).search).toHaveLength(
      255,
    );
  });

  it("takes the first value when a param is duplicated in the URL", () => {
    expect(
      parsePageInventorySearchParams(PROJECT_ID, { workflowStage: ["draft", "approved"] })
        .workflowStage,
    ).toBe("draft");
  });
});

describe("buildPageInventoryHref", () => {
  const baseQuery = {
    projectId: PROJECT_ID,
    pageType: null,
    workflowStage: null,
    indexStatus: null,
    template: null,
    search: null,
    targetKeyword: null,
    roadmapPhaseId: null,
    lastScanBefore: null,
    lastScanAfter: null,
    lastDeploymentBefore: null,
    lastDeploymentAfter: null,
    offset: 0,
    pageSize: 20 as const,
  };

  it("always includes projectId, even with nothing else set", () => {
    expect(buildPageInventoryHref(baseQuery, {})).toBe(`/page-inventory?projectId=${PROJECT_ID}`);
  });

  it("includes filters and omits offset=0/the default pageSize", () => {
    expect(
      buildPageInventoryHref(baseQuery, { workflowStage: "under_review", search: "pricing" }),
    ).toBe(`/page-inventory?projectId=${PROJECT_ID}&workflowStage=under_review&search=pricing`);
  });

  it("resets offset to 0 when an override other than offset itself is applied", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildPageInventoryHref(withOffset, { indexStatus: "index" })).toBe(
      `/page-inventory?projectId=${PROJECT_ID}&indexStatus=index`,
    );
  });

  it("keeps a nonzero offset when explicitly set", () => {
    expect(buildPageInventoryHref(baseQuery, { offset: 25 })).toBe(
      `/page-inventory?projectId=${PROJECT_ID}&offset=25`,
    );
  });

  it("includes a non-default pageSize and resets offset to 0", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildPageInventoryHref(withOffset, { pageSize: 50 })).toBe(
      `/page-inventory?projectId=${PROJECT_ID}&pageSize=50`,
    );
  });

  it("includes roadmapPhaseId when set", () => {
    const roadmapPhaseId = "22222222-2222-2222-2222-222222222222";
    expect(buildPageInventoryHref(baseQuery, { roadmapPhaseId })).toBe(
      `/page-inventory?projectId=${PROJECT_ID}&roadmapPhaseId=${roadmapPhaseId}`,
    );
  });
});

describe("pageWorkflowStageBadge", () => {
  it("maps under_review and revision_requested to the same degraded token, disambiguated by label", () => {
    expect(pageWorkflowStageBadge("under_review")).toEqual({
      token: "degraded",
      label: "Under Review",
    });
    expect(pageWorkflowStageBadge("revision_requested")).toEqual({
      token: "degraded",
      label: "Revision Requested",
    });
  });

  it("maps approved to healthy and rejected to unavailable", () => {
    expect(pageWorkflowStageBadge("approved").token).toBe("healthy");
    expect(pageWorkflowStageBadge("rejected").token).toBe("unavailable");
  });
});

describe("getPages", () => {
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
      getPages({
        projectId: PROJECT_ID,
        pageType: null,
        workflowStage: null,
        indexStatus: null,
        template: null,
        search: null,
        targetKeyword: null,
        roadmapPhaseId: null,
        lastScanBefore: null,
        lastScanAfter: null,
        lastDeploymentBefore: null,
        lastDeploymentAfter: null,
        offset: 0,
        pageSize: 20,
      }),
    ).rejects.toThrow(/Failed to load pages/);
  });

  it("requests the project-scoped route and one row past the chosen page size, to detect a real next page", async () => {
    const requestedUrls: string[] = [];
    global.fetch = vi.fn((url: string) => {
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [], correlationId: "test" }),
      } as Response);
    }) as typeof fetch;

    const roadmapPhaseId = "22222222-2222-2222-2222-222222222222";
    await getPages({
      projectId: PROJECT_ID,
      pageType: "landing",
      workflowStage: "draft",
      indexStatus: null,
      template: null,
      search: null,
      targetKeyword: null,
      roadmapPhaseId,
      lastScanBefore: null,
      lastScanAfter: null,
      lastDeploymentBefore: null,
      lastDeploymentAfter: null,
      offset: 25,
      pageSize: 20,
    });

    expect(requestedUrls[0]).toBe(
      `https://api.example.com/page-inventory/projects/${PROJECT_ID}/pages?pageType=landing&workflowStage=draft&roadmapPhaseId=${roadmapPhaseId}&limit=21&offset=25`,
    );
  });

  it("reports hasNextPage: true and trims the extra row when the backend returns one more than the page size", async () => {
    const items = Array.from({ length: 21 }, (_, i) => pageFixture(`p${i}`));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items, correlationId: "test" }),
    } as Response);

    const result = await getPages({
      projectId: PROJECT_ID,
      pageType: null,
      workflowStage: null,
      indexStatus: null,
      template: null,
      search: null,
      targetKeyword: null,
      roadmapPhaseId: null,
      lastScanBefore: null,
      lastScanAfter: null,
      lastDeploymentBefore: null,
      lastDeploymentAfter: null,
      offset: 0,
      pageSize: 20,
    });

    expect(result.items).toHaveLength(20);
    expect(result.hasNextPage).toBe(true);
  });
});

describe("getPage", () => {
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

  it("returns null for a malformed projectId without ever calling fetch", async () => {
    global.fetch = vi.fn() as typeof fetch;
    expect(await getPage("not-a-uuid", VALID_ID)).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns null for a malformed pageId without ever calling fetch", async () => {
    global.fetch = vi.fn() as typeof fetch;
    expect(await getPage(PROJECT_ID, "not-a-uuid")).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns null on a 404", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getPage(PROJECT_ID, VALID_ID)).toBeNull();
  });

  it("throws on a non-404 non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response);
    await expect(getPage(PROJECT_ID, VALID_ID)).rejects.toThrow(/Failed to load page/);
  });

  it("returns the page on a 200, requesting the project-scoped route", async () => {
    const requestedUrls: string[] = [];
    const page = pageFixture(VALID_ID, { pageName: "Pricing" });
    global.fetch = vi.fn((url: string) => {
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: page, correlationId: "test" }),
      } as Response);
    }) as typeof fetch;

    const result = await getPage(PROJECT_ID, VALID_ID);
    expect(requestedUrls[0]).toBe(
      `https://api.example.com/page-inventory/projects/${PROJECT_ID}/pages/${VALID_ID}`,
    );
    expect(result?.pageName).toBe("Pricing");
  });
});

describe("getPageUrls", () => {
  const originalFetch = global.fetch;
  const VALID_PAGE_ID = "11111111-1111-1111-1111-111111111111";

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
    expect(await getPageUrls("not-a-uuid", VALID_PAGE_ID)).toEqual([]);
    expect(await getPageUrls(PROJECT_ID, "not-a-uuid")).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns an empty array on a 404 instead of throwing", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getPageUrls(PROJECT_ID, VALID_PAGE_ID)).toEqual([]);
  });

  it(
    "degrades to an empty array on a non-404 non-OK response too, logging it, rather than " +
      "throwing (code-review finding — bundling this with getPage() in a Promise.all previously " +
      "meant a transient page_urls backend error crashed the entire detail page)",
    async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
      expect(await getPageUrls(PROJECT_ID, VALID_PAGE_ID)).toEqual([]);
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining("Failed to load page URLs"),
      );
    },
  );

  it("requests the /urls sub-resource route and returns every URL", async () => {
    const requestedUrls: string[] = [];
    const urls = [pageUrlFixture("u1"), pageUrlFixture("u2", { isCanonical: false })];
    global.fetch = vi.fn((url: string) => {
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: urls, correlationId: "test" }),
      } as Response);
    }) as typeof fetch;

    const result = await getPageUrls(PROJECT_ID, VALID_PAGE_ID);

    expect(requestedUrls[0]).toBe(
      `https://api.example.com/page-inventory/projects/${PROJECT_ID}/pages/${VALID_PAGE_ID}/urls`,
    );
    expect(result).toHaveLength(2);
  });
});
