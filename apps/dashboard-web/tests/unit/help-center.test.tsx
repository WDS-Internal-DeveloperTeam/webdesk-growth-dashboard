import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import type { HelpArticle } from "@webdesk/shared-types";
import {
  buildHelpCenterHref,
  getHelpArticle,
  getHelpArticles,
  helpArticlePublishBadge,
  parseHelpCenterSearchParams,
} from "../../lib/help-center.js";

describe("parseHelpCenterSearchParams", () => {
  it("defaults to no filters, offset 0, pageSize 20 when nothing is provided", () => {
    expect(parseHelpCenterSearchParams({})).toEqual({
      category: null,
      isPublished: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("parses valid category/isPublished/search/offset/pageSize values", () => {
    expect(
      parseHelpCenterSearchParams({
        category: "faq",
        isPublished: "true",
        search: "onboarding",
        offset: "25",
        pageSize: "50",
      }),
    ).toEqual({
      category: "faq",
      isPublished: true,
      search: "onboarding",
      offset: 25,
      pageSize: 50,
    });
  });

  it("parses isPublished=false as literal false, not falling through to null", () => {
    expect(parseHelpCenterSearchParams({ isPublished: "false" }).isPublished).toBe(false);
  });

  it("falls back to defaults for invalid/garbled enum values instead of passing them through", () => {
    expect(
      parseHelpCenterSearchParams({
        category: "not_a_real_category",
        isPublished: "maybe",
        offset: "not-a-number",
        pageSize: "37",
      }),
    ).toEqual({
      category: null,
      isPublished: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("clamps a negative offset to 0", () => {
    expect(parseHelpCenterSearchParams({ offset: "-10" }).offset).toBe(0);
  });

  it("clamps an overlong search term to 255 characters", () => {
    const overlong = "x".repeat(300);
    expect(parseHelpCenterSearchParams({ search: overlong }).search).toHaveLength(255);
  });

  it("takes the first value when a param is duplicated in the URL", () => {
    expect(parseHelpCenterSearchParams({ category: ["faq", "videos"] }).category).toBe("faq");
  });
});

describe("buildHelpCenterHref", () => {
  const baseQuery = {
    category: null,
    isPublished: null,
    search: null,
    offset: 0,
    pageSize: 20 as const,
  };

  it("returns the bare path when nothing is set", () => {
    expect(buildHelpCenterHref(baseQuery, {})).toBe("/help-center");
  });

  it("includes category/isPublished/search and omits offset=0/the default pageSize", () => {
    expect(
      buildHelpCenterHref(baseQuery, { category: "faq", isPublished: true, search: "sign-in" }),
    ).toBe("/help-center?category=faq&isPublished=true&search=sign-in");
  });

  it("includes isPublished=false explicitly rather than omitting it", () => {
    expect(buildHelpCenterHref(baseQuery, { isPublished: false })).toBe(
      "/help-center?isPublished=false",
    );
  });

  it("resets offset to 0 when an override other than offset itself is applied", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildHelpCenterHref(withOffset, { category: "onboarding" })).toBe(
      "/help-center?category=onboarding",
    );
  });

  it("keeps a nonzero offset when explicitly set", () => {
    expect(buildHelpCenterHref(baseQuery, { offset: 25 })).toBe("/help-center?offset=25");
  });

  it("includes a non-default pageSize and resets offset to 0", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildHelpCenterHref(withOffset, { pageSize: 50 })).toBe("/help-center?pageSize=50");
  });
});

describe("helpArticlePublishBadge", () => {
  it("maps published to healthy and unpublished to notConfigured", () => {
    expect(helpArticlePublishBadge(true)).toEqual({ token: "healthy", label: "Published" });
    expect(helpArticlePublishBadge(false)).toEqual({
      token: "notConfigured",
      label: "Unpublished",
    });
  });
});

function articleFixture(id: string, overrides: Partial<HelpArticle> = {}): HelpArticle {
  return {
    id,
    category: "faq",
    title: "How do I reset my password?",
    content: "<p>Use the sign-in page.</p>",
    isPublished: false,
    publishedAt: null,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-09-03T00:00:00.000Z",
    updatedAt: "2026-09-03T00:00:00.000Z",
    ...overrides,
  };
}

describe("getHelpArticles", () => {
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
      getHelpArticles({ category: null, isPublished: null, search: null, offset: 0, pageSize: 20 }),
    ).rejects.toThrow(/Failed to load help articles/);
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

    await getHelpArticles({
      category: "faq",
      isPublished: true,
      search: "sign-in",
      offset: 25,
      pageSize: 20,
    });

    expect(requestedUrls[0]).toBe(
      "https://api.example.com/help-center/articles?category=faq&isPublished=true&search=sign-in&limit=21&offset=25",
    );
  });

  it("reports hasNextPage: true and trims the extra row when the backend returns one more than the page size", async () => {
    const items = Array.from({ length: 21 }, (_, i) => articleFixture(`a${i}`));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items, correlationId: "test" }),
    } as Response);

    const result = await getHelpArticles({
      category: null,
      isPublished: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });

    expect(result.items).toHaveLength(20);
    expect(result.hasNextPage).toBe(true);
  });
});

describe("getHelpArticle", () => {
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
    const result = await getHelpArticle("not-a-uuid");
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns null on a 404", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getHelpArticle(VALID_ID)).toBeNull();
  });

  it("throws on a non-404 non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response);
    await expect(getHelpArticle(VALID_ID)).rejects.toThrow(/Failed to load help article/);
  });

  it("returns the help article on a 200", async () => {
    const article = articleFixture(VALID_ID, { title: "Getting started" });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: article, correlationId: "test" }),
    } as Response);

    const result = await getHelpArticle(VALID_ID);
    expect(result?.id).toBe(VALID_ID);
    expect(result?.title).toBe("Getting started");
  });
});
