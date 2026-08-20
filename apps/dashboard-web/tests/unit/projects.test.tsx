import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import type { Project, ProjectDetail } from "@webdesk/shared-types";
import {
  buildProjectsHref,
  formatTimestamp,
  getProject,
  getProjectDetail,
  getProjects,
  isSafeHttpUrl,
  objectiveStatusBadge,
  parseProjectsSearchParams,
  projectStatusBadge,
  roadmapItemStatusBadge,
} from "../../lib/projects.js";

describe("parseProjectsSearchParams", () => {
  it("defaults to updatedAt DESC with no filters, pageSize 20, when nothing is provided", () => {
    expect(parseProjectsSearchParams({})).toEqual({
      search: null,
      status: null,
      sortBy: "updatedAt",
      sortOrder: "DESC",
      offset: 0,
      pageSize: 20,
    });
  });

  it("parses valid search, status, sort, offset, and pageSize values", () => {
    expect(
      parseProjectsSearchParams({
        search: "acme",
        status: "paused",
        sortBy: "name",
        sortOrder: "ASC",
        offset: "25",
        pageSize: "50",
      }),
    ).toEqual({
      search: "acme",
      status: "paused",
      sortBy: "name",
      sortOrder: "ASC",
      offset: 25,
      pageSize: 50,
    });
  });

  it("falls back to defaults for invalid/garbled enum values instead of passing them through", () => {
    expect(
      parseProjectsSearchParams({
        status: "deleted",
        sortBy: "ownerUserId",
        sortOrder: "sideways",
        offset: "not-a-number",
        pageSize: "1000",
      }),
    ).toEqual({
      search: null,
      status: null,
      sortBy: "updatedAt",
      sortOrder: "DESC",
      offset: 0,
      pageSize: 20,
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
    pageSize: 20 as const,
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

  it("includes a non-default pageSize and resets offset to 0", () => {
    const paged = { ...baseQuery, offset: 50 };
    expect(buildProjectsHref(paged, { pageSize: 100 })).toBe("/projects?pageSize=100");
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
        pageSize: 20,
      }),
    ).rejects.toThrow(/Failed to load projects/);
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

    await getProjects({
      search: "acme",
      status: "active",
      sortBy: "name",
      sortOrder: "ASC",
      offset: 25,
      pageSize: 20,
    });

    expect(requestedUrls[0]).toBe(
      "https://api.example.com/projects?search=acme&status=active&sortBy=name&sortOrder=ASC&limit=21&offset=25",
    );
  });

  it("honors a non-default pageSize in both the request limit and the trimmed result", async () => {
    const requestedUrls: string[] = [];
    const items = Array.from({ length: 11 }, (_, i) => projectFixture(`p${i}`));
    global.fetch = vi.fn((url: string) => {
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: items, correlationId: "test" }),
      } as Response);
    }) as typeof fetch;

    const result = await getProjects({
      search: null,
      status: null,
      sortBy: "updatedAt",
      sortOrder: "DESC",
      offset: 0,
      pageSize: 10,
    });

    expect(requestedUrls[0]).toContain("limit=11");
    expect(result.items).toHaveLength(10);
    expect(result.hasNextPage).toBe(true);
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
    const items = Array.from({ length: 20 }, (_, i) => projectFixture(`p${i}`));
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
      pageSize: 20,
    });

    expect(result.items).toHaveLength(20);
    expect(result.hasNextPage).toBe(false);
  });

  it("reports hasNextPage: true and trims the extra row when the backend returns one more than the page size", async () => {
    const items = Array.from({ length: 21 }, (_, i) => projectFixture(`p${i}`));
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
      pageSize: 20,
    });

    expect(result.items).toHaveLength(20);
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

describe("isSafeHttpUrl", () => {
  it("accepts http and https URLs", () => {
    expect(isSafeHttpUrl("http://staging.example.com")).toBe(true);
    expect(isSafeHttpUrl("https://staging.example.com/path?query=1")).toBe(true);
  });

  it("rejects a javascript: URL — the backend's z.string().url() check passes it through unsanitized", () => {
    expect(isSafeHttpUrl("javascript:alert(document.cookie)")).toBe(false);
  });

  it("rejects other non-http(s) schemes and unparseable strings", () => {
    expect(isSafeHttpUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSafeHttpUrl("not a url")).toBe(false);
  });
});

describe("getProject", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    vi.mocked(cookies).mockResolvedValue({ toString: () => "sid=abc" } as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  const VALID_ID = "66666666-6666-6666-6666-666666666666";

  function projectDetailFixture(): ProjectDetail {
    return {
      id: VALID_ID,
      publicId: "proj-1",
      name: "Acme Website",
      description: "The Acme website growth engagement.",
      status: "active",
      confidentiality: "internal",
      activePhaseId: null,
      ownerUserId: null,
      createdAt: "2026-08-16T00:00:00.000Z",
      updatedAt: "2026-08-16T00:00:00.000Z",
    };
  }

  it("rejects a malformed (non-UUID) projectId as not-found, without calling fetch at all", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    expect(await getProject("not-a-real-id")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches only GET /projects/:projectId — no sub-resource requests, unlike getProjectDetail", async () => {
    const project = projectDetailFixture();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: project, correlationId: "test" }),
    } as Response);
    global.fetch = fetchMock as typeof fetch;

    const result = await getProject(VALID_ID);

    expect(result).toEqual(project);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.com/projects/${VALID_ID}`,
      expect.objectContaining({ headers: { cookie: "sid=abc" } }),
    );
  });

  it("returns null on a 404", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);

    expect(await getProject(VALID_ID)).toBeNull();
  });

  it("throws on a non-OK, non-404 response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);

    await expect(getProject(VALID_ID)).rejects.toThrow(/Failed to load project/);
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

  const VALID_ID = "44444444-4444-4444-4444-444444444444";
  const MISSING_ID = "55555555-5555-5555-5555-555555555555";

  it("rejects a malformed (non-UUID) projectId as not-found, without calling fetch at all", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    const result = await getProjectDetail("not-a-real-id");

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null when GET /projects/:projectId responds 404 — the sub-resource fetches it fired concurrently are discarded, not awaited", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    global.fetch = fetchMock as typeof fetch;

    const result = await getProjectDetail(MISSING_ID);

    expect(result).toBeNull();
    // 1 primary + 6 sub-resource fetches (roadmap-items, objectives, environments, repositories,
    // team, approvers) — all started concurrently, not gated on the primary.
    expect(fetchMock).toHaveBeenCalledTimes(7);
  });

  it("throws on a non-OK, non-404 primary response instead of treating it as missing", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response);

    await expect(getProjectDetail(VALID_ID)).rejects.toThrow(/Failed to load project/);
  });

  it("throws if a sub-resource fetch fails after the project itself loads successfully", async () => {
    global.fetch = vi.fn((url: string) => {
      if (url.endsWith(`/projects/${VALID_ID}`)) {
        return Promise.resolve(okJson(projectDetailFixture()));
      }
      return Promise.resolve({ ok: false, status: 500 } as Response);
    }) as typeof fetch;

    await expect(getProjectDetail(VALID_ID)).rejects.toThrow(/Failed to load project/);
  });

  it("fetches the project and every sub-resource concurrently, resolving team and approver identities", async () => {
    const project = projectDetailFixture();
    const teamUserId1 = "66666666-6666-6666-6666-666666666666";
    const teamUserId2 = "77777777-7777-7777-7777-777777777777";
    const approverUserId = "88888888-8888-8888-8888-888888888888";
    const requestedUrls: string[] = [];
    global.fetch = vi.fn((url: string) => {
      requestedUrls.push(url);
      if (url.endsWith(`/projects/${VALID_ID}`)) {
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
        return Promise.resolve(
          okJson([
            { id: "team-entry-1", userId: teamUserId1, addedAt: "2026-08-18T00:00:00.000Z" },
            { id: "team-entry-2", userId: teamUserId2, addedAt: "2026-08-18T00:00:00.000Z" },
          ]),
        );
      }
      if (url.endsWith("/approvers")) {
        return Promise.resolve(
          okJson([{ id: approverUserId, displayName: "Ada Approver", email: "ada@example.com" }]),
        );
      }
      if (url.endsWith(`/users/${teamUserId1}`)) {
        return Promise.resolve(
          okJson({ id: teamUserId1, displayName: "Tom Team", email: "tom@example.com" }),
        );
      }
      if (url.endsWith(`/users/${teamUserId2}`)) {
        return Promise.resolve(
          okJson({ id: teamUserId2, displayName: "Tia Team", email: "tia@example.com" }),
        );
      }
      throw new Error(`Unexpected URL in test: ${url}`);
    }) as typeof fetch;

    const result = await getProjectDetail(VALID_ID);

    expect(result).not.toBeNull();
    expect(result?.project).toEqual(project);
    expect(result?.roadmapItems).toHaveLength(1);
    expect(result?.team).toEqual([
      {
        id: "team-entry-1",
        addedAt: "2026-08-18T00:00:00.000Z",
        user: { id: teamUserId1, displayName: "Tom Team", email: "tom@example.com" },
      },
      {
        id: "team-entry-2",
        addedAt: "2026-08-18T00:00:00.000Z",
        user: { id: teamUserId2, displayName: "Tia Team", email: "tia@example.com" },
      },
    ]);
    expect(result?.approvers).toEqual([
      { id: approverUserId, displayName: "Ada Approver", email: "ada@example.com" },
    ]);
    expect(requestedUrls).toEqual(
      expect.arrayContaining([
        `https://api.example.com/projects/${VALID_ID}`,
        `https://api.example.com/projects/${VALID_ID}/roadmap-items`,
        `https://api.example.com/projects/${VALID_ID}/objectives`,
        `https://api.example.com/projects/${VALID_ID}/environments`,
        `https://api.example.com/projects/${VALID_ID}/repositories`,
        `https://api.example.com/projects/${VALID_ID}/team`,
        `https://api.example.com/projects/${VALID_ID}/approvers`,
      ]),
    );
  });

  it("resolves a team entry to user: null when its userId no longer resolves (disabled/deleted account)", async () => {
    const project = projectDetailFixture();
    const staleUserId = "99999999-9999-9999-9999-999999999999";
    global.fetch = vi.fn((url: string) => {
      if (url.endsWith(`/projects/${VALID_ID}`)) {
        return Promise.resolve(okJson(project));
      }
      if (url.endsWith("/roadmap-items") || url.endsWith("/objectives")) {
        return Promise.resolve(okJson([]));
      }
      if (url.endsWith("/environments") || url.endsWith("/repositories")) {
        return Promise.resolve(okJson([]));
      }
      if (url.endsWith("/team")) {
        return Promise.resolve(
          okJson([
            { id: "team-entry-1", userId: staleUserId, addedAt: "2026-08-18T00:00:00.000Z" },
          ]),
        );
      }
      if (url.endsWith("/approvers")) {
        return Promise.resolve(okJson([]));
      }
      if (url.endsWith(`/users/${staleUserId}`)) {
        return Promise.resolve({ ok: false, status: 404 } as Response);
      }
      throw new Error(`Unexpected URL in test: ${url}`);
    }) as typeof fetch;

    const result = await getProjectDetail(VALID_ID);

    expect(result?.team).toEqual([
      { id: "team-entry-1", addedAt: "2026-08-18T00:00:00.000Z", user: null },
    ]);
  });

  it("resolves approvers: null when GET .../approvers responds 403 (caller lacks users_roles:view)", async () => {
    const project = projectDetailFixture();
    global.fetch = vi.fn((url: string) => {
      if (url.endsWith(`/projects/${VALID_ID}`)) {
        return Promise.resolve(okJson(project));
      }
      if (
        url.endsWith("/roadmap-items") ||
        url.endsWith("/objectives") ||
        url.endsWith("/environments") ||
        url.endsWith("/repositories") ||
        url.endsWith("/team")
      ) {
        return Promise.resolve(okJson([]));
      }
      if (url.endsWith("/approvers")) {
        return Promise.resolve({ ok: false, status: 403 } as Response);
      }
      throw new Error(`Unexpected URL in test: ${url}`);
    }) as typeof fetch;

    const result = await getProjectDetail(VALID_ID);

    expect(result?.approvers).toBeNull();
  });
});
