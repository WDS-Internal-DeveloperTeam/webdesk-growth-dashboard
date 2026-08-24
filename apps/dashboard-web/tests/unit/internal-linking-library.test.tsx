import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import type { InternalLink, Page } from "@webdesk/shared-types";
import {
  buildInternalLinkLibraryHref,
  getInternalLink,
  getInternalLinks,
  getPagesForInternalLinkPicker,
  internalLinkPriorityBadge,
  internalLinkStatusBadge,
  parseInternalLinkLibrarySearchParams,
} from "../../lib/internal-linking-library.js";

const PROJECT_ID = "99999999-9999-9999-9999-999999999999";
const LINK_ID = "11111111-1111-1111-1111-111111111111";
const SOURCE_PAGE_ID = "22222222-2222-2222-2222-222222222222";
const TARGET_PAGE_ID = "33333333-3333-3333-3333-333333333333";

function linkFixture(id: string, overrides: Partial<InternalLink> = {}): InternalLink {
  return {
    id,
    projectId: PROJECT_ID,
    publicId: `LINK-${id}`,
    sourcePageId: SOURCE_PAGE_ID,
    targetPageId: TARGET_PAGE_ID,
    relationship: null,
    anchor: null,
    context: null,
    linkType: null,
    priority: null,
    status: "proposed",
    detector: null,
    assignedApproverUserId: null,
    relatedStrategyRecordId: null,
    implementedAt: null,
    verifiedAt: null,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
    ...overrides,
  };
}

function pageFixture(id: string, overrides: Partial<Page> = {}): Page {
  return {
    id,
    projectId: PROJECT_ID,
    publicId: `PG-${id}`,
    pageName: "Homepage",
    pageType: null,
    existingOrProposed: "existing",
    indexStatus: "unknown",
    template: null,
    roadmapPhaseId: null,
    workflowStage: "draft",
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
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
    ...overrides,
  };
}

describe("parseInternalLinkLibrarySearchParams", () => {
  it("defaults to no filters, offset 0, pageSize 20 when nothing is provided", () => {
    expect(parseInternalLinkLibrarySearchParams(PROJECT_ID, {})).toEqual({
      projectId: PROJECT_ID,
      sourcePageId: null,
      targetPageId: null,
      status: null,
      priority: null,
      linkType: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("parses valid filter/offset/pageSize values", () => {
    expect(
      parseInternalLinkLibrarySearchParams(PROJECT_ID, {
        sourcePageId: SOURCE_PAGE_ID,
        targetPageId: TARGET_PAGE_ID,
        status: "approved",
        priority: "high",
        linkType: "contextual",
        search: "pricing",
        offset: "25",
        pageSize: "50",
      }),
    ).toEqual({
      projectId: PROJECT_ID,
      sourcePageId: SOURCE_PAGE_ID,
      targetPageId: TARGET_PAGE_ID,
      status: "approved",
      priority: "high",
      linkType: "contextual",
      search: "pricing",
      offset: 25,
      pageSize: 50,
    });
  });

  it("falls back to null for an invalid status/priority value instead of passing it through", () => {
    const result = parseInternalLinkLibrarySearchParams(PROJECT_ID, {
      status: "not_a_real_status",
      priority: "extreme",
    });
    expect(result.status).toBeNull();
    expect(result.priority).toBeNull();
  });

  it("drops a malformed (non-UUID-shaped) sourcePageId/targetPageId to null instead of passing it through", () => {
    const result = parseInternalLinkLibrarySearchParams(PROJECT_ID, {
      sourcePageId: "not-a-uuid",
      targetPageId: "also-not-a-uuid",
    });
    expect(result.sourcePageId).toBeNull();
    expect(result.targetPageId).toBeNull();
  });

  it("clamps a negative offset to 0", () => {
    expect(parseInternalLinkLibrarySearchParams(PROJECT_ID, { offset: "-10" }).offset).toBe(0);
  });

  it("clamps an overlong linkType/search filter to 255 characters", () => {
    const overlong = "x".repeat(300);
    expect(
      parseInternalLinkLibrarySearchParams(PROJECT_ID, { linkType: overlong }).linkType,
    ).toHaveLength(255);
    expect(
      parseInternalLinkLibrarySearchParams(PROJECT_ID, { search: overlong }).search,
    ).toHaveLength(255);
  });

  it("takes the first value when a param is duplicated in the URL", () => {
    expect(
      parseInternalLinkLibrarySearchParams(PROJECT_ID, { status: ["approved", "verified"] }).status,
    ).toBe("approved");
  });
});

describe("buildInternalLinkLibraryHref", () => {
  const baseQuery = {
    projectId: PROJECT_ID,
    sourcePageId: null,
    targetPageId: null,
    status: null,
    priority: null,
    linkType: null,
    search: null,
    offset: 0,
    pageSize: 20 as const,
  };

  it("always includes projectId, even with nothing else set", () => {
    expect(buildInternalLinkLibraryHref(baseQuery, {})).toBe(
      `/internal-linking-library?projectId=${PROJECT_ID}`,
    );
  });

  it("includes filters and omits offset=0/the default pageSize", () => {
    expect(buildInternalLinkLibraryHref(baseQuery, { status: "approved", search: "pricing" })).toBe(
      `/internal-linking-library?projectId=${PROJECT_ID}&status=approved&search=pricing`,
    );
  });

  it("resets offset to 0 when an override other than offset itself is applied", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildInternalLinkLibraryHref(withOffset, { priority: "high" })).toBe(
      `/internal-linking-library?projectId=${PROJECT_ID}&priority=high`,
    );
  });

  it("keeps a nonzero offset when explicitly set", () => {
    expect(buildInternalLinkLibraryHref(baseQuery, { offset: 25 })).toBe(
      `/internal-linking-library?projectId=${PROJECT_ID}&offset=25`,
    );
  });
});

describe("internalLinkStatusBadge / internalLinkPriorityBadge", () => {
  it("maps verified to healthy and proposed to unknown", () => {
    expect(internalLinkStatusBadge("verified").token).toBe("healthy");
    expect(internalLinkStatusBadge("proposed").token).toBe("unknown");
  });

  it("maps high priority to degraded and low to unknown", () => {
    expect(internalLinkPriorityBadge("high").token).toBe("degraded");
    expect(internalLinkPriorityBadge("low").token).toBe("unknown");
  });
});

describe("getInternalLinks", () => {
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
      getInternalLinks({
        projectId: PROJECT_ID,
        sourcePageId: null,
        targetPageId: null,
        status: null,
        priority: null,
        linkType: null,
        search: null,
        offset: 0,
        pageSize: 20,
      }),
    ).rejects.toThrow(/Failed to load internal links/);
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

    await getInternalLinks({
      projectId: PROJECT_ID,
      sourcePageId: null,
      targetPageId: null,
      status: "approved",
      priority: null,
      linkType: null,
      search: null,
      offset: 25,
      pageSize: 20,
    });

    expect(requestedUrls[0]).toBe(
      `https://api.example.com/internal-linking-library/projects/${PROJECT_ID}/links?status=approved&limit=21&offset=25`,
    );
  });

  it("reports hasNextPage: true and trims the extra row when the backend returns one more than the page size", async () => {
    const items = Array.from({ length: 21 }, (_, i) => linkFixture(`link${i}`));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items, correlationId: "test" }),
    } as Response);

    const result = await getInternalLinks({
      projectId: PROJECT_ID,
      sourcePageId: null,
      targetPageId: null,
      status: null,
      priority: null,
      linkType: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });

    expect(result.items).toHaveLength(20);
    expect(result.hasNextPage).toBe(true);
  });
});

describe("getInternalLink", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    vi.mocked(cookies).mockResolvedValue({ toString: () => "sid=abc" } as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns null for a malformed projectId/linkId without ever calling fetch", async () => {
    global.fetch = vi.fn() as typeof fetch;
    await expect(getInternalLink("not-a-uuid", LINK_ID)).resolves.toBeNull();
    await expect(getInternalLink(PROJECT_ID, "not-a-uuid")).resolves.toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns null on a 404", async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 404, ok: false } as Response);
    await expect(getInternalLink(PROJECT_ID, LINK_ID)).resolves.toBeNull();
  });

  it("throws on a non-404 non-OK status", async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 500, ok: false } as Response);
    await expect(getInternalLink(PROJECT_ID, LINK_ID)).rejects.toThrow(
      /Failed to load internal link/,
    );
  });

  it("returns the link on success", async () => {
    const link = linkFixture(LINK_ID);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: link, correlationId: "test" }),
    } as Response);
    await expect(getInternalLink(PROJECT_ID, LINK_ID)).resolves.toEqual(link);
  });
});

describe("getPagesForInternalLinkPicker", () => {
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

  it("degrades to an empty array (never throws) when the underlying fetch fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(getPagesForInternalLinkPicker(PROJECT_ID)).resolves.toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });

  it("returns up to 100 pages on success", async () => {
    const items = [pageFixture(SOURCE_PAGE_ID), pageFixture(TARGET_PAGE_ID)];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items, correlationId: "test" }),
    } as Response);
    await expect(getPagesForInternalLinkPicker(PROJECT_ID)).resolves.toEqual(items);
  });
});
