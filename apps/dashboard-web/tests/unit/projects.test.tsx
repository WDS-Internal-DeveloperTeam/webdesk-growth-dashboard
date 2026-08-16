import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import type { Project, ProjectDetail } from "@webdesk/shared-types";
import {
  buildProjectsHref,
  formatTimestamp,
  getProjectDetail,
  getProjects,
  objectiveStatusBadge,
  parseProjectsSearchParams,
  projectStatusBadge,
  roadmapItemStatusBadge,
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

  it("clamps an over-length search term instead of sending it through to GET /projects", () => {
    const search = parseProjectsSearchParams({ search: "a".repeat(300) }).search;
    expect(search).toHaveLength(255);
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

  it("requests one row past the display page size, to detect a real next page", async () => {
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
      "https://api.example.com/projects?search=acme&status=active&sortBy=name&sortOrder=ASC&limit=26&offset=25",
    );
  });

  function projectFixture(id: string): Project {
    return {
      id,
      publicId: id,
      name: id,
      description: null,
      status: "active",
      confidentiality: "internal",
      createdAt: "2026-08-16T00:00:00.000Z",
      updatedAt: "2026-08-16T00:00:00.000Z",
    };
  }

  it("reports hasNextPage: false and returns every row when the backend returns a full page or fewer", async () => {
    const items = Array.from({ length: 25 }, (_, i) => projectFixture(`p${i}`));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items, correlationId: "test" }),
    } as Response);

    const result = await getProjects({
      search: null,
      status: null,
      sortBy: "updatedAt",
      sortOrder: "DESC",
      offset: 0,
    });

    expect(result.items).toHaveLength(25);
    expect(result.hasNextPage).toBe(false);
  });

  it("reports hasNextPage: true and trims the extra row when the backend returns one more than the page size", async () => {
    const items = Array.from({ length: 26 }, (_, i) => projectFixture(`p${i}`));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items, correlationId: "test" }),
    } as Response);

    const result = await getProjects({
      search: null,
      status: null,
      sortBy: "updatedAt",
      sortOrder: "DESC",
      offset: 0,
    });

    expect(result.items).toHaveLength(25);
    expect(result.hasNextPage).toBe(true);
  });
});

describe("formatTimestamp", () => {
  it("formats an ISO timestamp as a UTC-labeled string, truncated to the minute", () => {
    expect(formatTimestamp("2026-08-16T13:05:42.123Z")).toBe("2026-08-16 13:05 UTC");
  });
});

describe("roadmapItemStatusBadge", () => {
  it("maps each roadmap-item status to a distinct label, sharing the healthy token for active/complete", () => {
    expect(roadmapItemStatusBadge("not_started")).toEqual({
      token: "unknown",
      label: "Not started",
    });
    expect(roadmapItemStatusBadge("active")).toEqual({ token: "healthy", label: "Active" });
    expect(roadmapItemStatusBadge("complete")).toEqual({ token: "healthy", label: "Complete" });
    expect(roadmapItemStatusBadge("skipped")).toEqual({ token: "notConfigured", label: "Skipped" });
  });
});

describe("objectiveStatusBadge", () => {
  it("maps each objective status to a distinct label", () => {
    expect(objectiveStatusBadge("open")).toEqual({ token: "unknown", label: "Open" });
    expect(objectiveStatusBadge("complete")).toEqual({ token: "healthy", label: "Complete" });
  });
});

describe("getProjectDetail", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    vi.mocked(cookies).mockResolvedValue({ toString: () => "sid=abc" } as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function projectDetailFixture(): ProjectDetail {
    return {
      id: "11111111-1111-1111-1111-111111111111",
      publicId: "proj-1",
      name: "Acme Website",
      description: "The Acme website growth engagement.",
      status: "active",
      confidentiality: "internal",
      activePhaseId: "22222222-2222-2222-2222-222222222222",
      ownerUserId: "33333333-3333-3333-3333-333333333333",
      createdAt: "2026-08-16T00:00:00.000Z",
      updatedAt: "2026-08-16T00:00:00.000Z",
    };
  }

  function okJson(data: unknown): Response {
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true, data, correlationId: "test" }),
    } as Response;
  }

  it("returns null when GET /projects/:projectId responds 404, without fetching any sub-resource", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    global.fetch = fetchMock as typeof fetch;

    const result = await getProjectDetail("missing-id");

    expect(result).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws on a non-OK, non-404 primary response instead of treating it as missing", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response);

    await expect(getProjectDetail("some-id")).rejects.toThrow(/Failed to load project/);
  });

  it("throws if a sub-resource fetch fails after the project itself loads successfully", async () => {
    global.fetch = vi.fn((url: string) => {
      if (url.endsWith("/projects/some-id")) {
        return Promise.resolve(okJson(projectDetailFixture()));
      }
      return Promise.resolve({ ok: false, status: 500 } as Response);
    }) as typeof fetch;

    await expect(getProjectDetail("some-id")).rejects.toThrow(/Failed to load project/);
  });

  it("fetches the project and every sub-resource, returning a real team headcount", async () => {
    const project = projectDetailFixture();
    const requestedUrls: string[] = [];
    global.fetch = vi.fn((url: string) => {
      requestedUrls.push(url);
      if (url.endsWith("/projects/some-id")) {
        return Promise.resolve(okJson(project));
      }
      if (url.endsWith("/roadmap-items")) {
        return Promise.resolve(
          okJson([{ id: project.activePhaseId, name: "Phase 1", sequence: 1, status: "active" }]),
        );
      }
      if (url.endsWith("/objectives")) {
        return Promise.resolve(okJson([]));
      }
      if (url.endsWith("/environments")) {
        return Promise.resolve(okJson([]));
      }
      if (url.endsWith("/repositories")) {
        return Promise.resolve(okJson([]));
      }
      if (url.endsWith("/team")) {
        return Promise.resolve(okJson([{ id: "a" }, { id: "b" }, { id: "c" }]));
      }
      throw new Error(`Unexpected URL in test: ${url}`);
    }) as typeof fetch;

    const result = await getProjectDetail("some-id");

    expect(result).not.toBeNull();
    expect(result?.project).toEqual(project);
    expect(result?.roadmapItems).toHaveLength(1);
    expect(result?.teamCount).toBe(3);
    expect(requestedUrls).toEqual(
      expect.arrayContaining([
        "https://api.example.com/projects/some-id",
        "https://api.example.com/projects/some-id/roadmap-items",
        "https://api.example.com/projects/some-id/objectives",
        "https://api.example.com/projects/some-id/environments",
        "https://api.example.com/projects/some-id/repositories",
        "https://api.example.com/projects/some-id/team",
      ]),
    );
  });
});
