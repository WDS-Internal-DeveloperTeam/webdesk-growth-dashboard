import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import {
  buildProjectsHref,
  getProjects,
  parseProjectsSearchParams,
  projectStatusBadge,
} from "../../lib/projects.js";

describe("parseProjectsSearchParams", () => {
  it("defaults to updatedAt DESC with no filters when nothing is provided", () => {
    expect(parseProjectsSearchParams({})).toEqual({
      search: null,
      status: null,
      sortBy: "updatedAt",
      sortOrder: "DESC",
      offset: 0,
    });
  });

  it("parses valid search, status, sort, and offset values", () => {
    expect(
      parseProjectsSearchParams({
        search: "acme",
        status: "paused",
        sortBy: "name",
        sortOrder: "ASC",
        offset: "25",
      }),
    ).toEqual({
      search: "acme",
      status: "paused",
      sortBy: "name",
      sortOrder: "ASC",
      offset: 25,
    });
  });

  it("falls back to defaults for invalid/garbled enum values instead of passing them through", () => {
    expect(
      parseProjectsSearchParams({
        status: "deleted",
        sortBy: "ownerUserId",
        sortOrder: "sideways",
        offset: "not-a-number",
      }),
    ).toEqual({
      search: null,
      status: null,
      sortBy: "updatedAt",
      sortOrder: "DESC",
      offset: 0,
    });
  });

  it("treats a blank/whitespace-only search as no search", () => {
    expect(parseProjectsSearchParams({ search: "   " }).search).toBeNull();
  });

  it("clamps a negative offset to 0", () => {
    expect(parseProjectsSearchParams({ offset: "-10" }).offset).toBe(0);
  });

  it("takes the first value when a param is duplicated in the URL", () => {
    expect(parseProjectsSearchParams({ search: ["first", "second"] }).search).toBe("first");
  });
});

describe("buildProjectsHref", () => {
  const baseQuery = {
    search: null,
    status: null,
    sortBy: "updatedAt" as const,
    sortOrder: "DESC" as const,
    offset: 0,
  };

  it("returns the bare /projects path when the query is entirely default", () => {
    expect(buildProjectsHref(baseQuery, {})).toBe("/projects");
  });

  it("includes only non-default fields in the query string", () => {
    expect(buildProjectsHref(baseQuery, { search: "acme", status: "active" })).toBe(
      "/projects?search=acme&status=active",
    );
  });

  it("resets offset to 0 when a filter/sort override is applied without an explicit offset", () => {
    const paged = { ...baseQuery, offset: 50 };
    expect(buildProjectsHref(paged, { sortBy: "name" })).toBe("/projects?sortBy=name");
  });

  it("keeps an explicit offset override (pagination links)", () => {
    expect(buildProjectsHref(baseQuery, { offset: 25 })).toBe("/projects?offset=25");
  });

  it("preserves existing query fields not touched by the override", () => {
    const filtered = { ...baseQuery, search: "acme", status: "active" as const };
    expect(buildProjectsHref(filtered, { sortBy: "name" })).toBe(
      "/projects?search=acme&status=active&sortBy=name",
    );
  });
});

describe("projectStatusBadge", () => {
  it("maps each project status to a distinct semantic status token", () => {
    expect(projectStatusBadge("active")).toEqual({ token: "healthy", label: "Active" });
    expect(projectStatusBadge("paused")).toEqual({ token: "degraded", label: "Paused" });
    expect(projectStatusBadge("archived")).toEqual({ token: "unknown", label: "Archived" });
  });
});

describe("getProjects", () => {
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
      getProjects({
        search: null,
        status: null,
        sortBy: "updatedAt",
        sortOrder: "DESC",
        offset: 0,
      }),
    ).rejects.toThrow(/Failed to load projects/);
  });

  it("sends the expected query params to GET /projects", async () => {
    const requestedUrls: string[] = [];
    global.fetch = vi.fn((url: string) => {
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [], correlationId: "test" }),
      } as Response);
    }) as typeof fetch;

    await getProjects({
      search: "acme",
      status: "active",
      sortBy: "name",
      sortOrder: "ASC",
      offset: 25,
    });

    expect(requestedUrls[0]).toBe(
      "https://api.example.com/projects?search=acme&status=active&sortBy=name&sortOrder=ASC&limit=25&offset=25",
    );
  });
});
