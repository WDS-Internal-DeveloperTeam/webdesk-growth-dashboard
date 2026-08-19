import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import { getServerSession } from "../../lib/server-session.js";

const API_BASE_URL = "https://api.example.com";

function mockCookieHeader(header: string): void {
  vi.mocked(cookies).mockResolvedValue({ toString: () => header } as never);
}

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true, data, correlationId: "test" }),
  } as Response;
}

function meFixture(): unknown {
  return { id: "u1", email: "jane@example.com", displayName: "Jane Doe" };
}

/**
 * Regression coverage for the code-review fixes to `getServerSession()`'s `/projects` handling
 * (see `docs/implementation/dashboard-web-project-switcher.md` §2b): a `/projects`-only failure —
 * network-level or a bad HTTP status — must degrade to an empty project list, not crash the whole
 * session (which would also take down `/me`/`/me/navigation`, even when those succeeded).
 */
describe("getServerSession — /projects resilience", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = API_BASE_URL;
    mockCookieHeader("sid=abc123");
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("resolves with projects: [] instead of throwing when GET /projects rejects with a network error", async () => {
    global.fetch = vi.fn((url: string) => {
      if (url.includes("/projects")) {
        return Promise.reject(new Error("network error"));
      }
      if (url.includes("/me/navigation")) {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse(meFixture()));
    }) as typeof fetch;

    const session = await getServerSession();

    expect(session).not.toBeNull();
    expect(session?.projects).toEqual([]);
    expect(session?.me.id).toBe("u1");
  });

  it("resolves with projects: [] instead of throwing when GET /projects returns a 500", async () => {
    global.fetch = vi.fn((url: string) => {
      if (url.includes("/projects")) {
        return Promise.resolve({ ok: false, status: 500, json: async () => ({}) } as Response);
      }
      if (url.includes("/me/navigation")) {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse(meFixture()));
    }) as typeof fetch;

    const session = await getServerSession();

    expect(session).not.toBeNull();
    expect(session?.projects).toEqual([]);
  });

  it("requests GET /projects with a bounded limit query param, not an unbounded call", async () => {
    const requestedUrls: string[] = [];
    global.fetch = vi.fn((url: string) => {
      requestedUrls.push(url);
      if (url.includes("/projects")) {
        return Promise.resolve(jsonResponse([]));
      }
      if (url.includes("/me/navigation")) {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse(meFixture()));
    }) as typeof fetch;

    await getServerSession();

    const projectsUrl = requestedUrls.find((url) => url.includes("/projects"));
    expect(projectsUrl).toMatch(/[?&]limit=\d+/);
  });
});

/**
 * Coverage for the Home page's Git/Release Status widget data source: `/health`'s `build` block,
 * parsed into `systemStatus.release`. Real backend behavior (`apps/dashboard-api/src/health/*`)
 * always returns a full `build` object — `undefined` here only models environments that predate
 * build-metadata wiring or a genuinely malformed response, not an expected steady-state case.
 */
describe("getServerSession — systemStatus.release", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = API_BASE_URL;
    mockCookieHeader("sid=abc123");
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("populates release from /health's build block", async () => {
    global.fetch = vi.fn((url: string) => {
      if (url.includes("/health")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            status: "ok",
            service: "dashboard-api",
            timestamp: "2026-01-01T00:00:00Z",
            build: {
              version: "1.2.3",
              commitSha: "abcdef1234567890",
              commitShaShort: "abcdef1",
              environment: "production",
              deploymentId: "dep-1",
              processStartedAt: "2026-01-01T00:00:00Z",
            },
          }),
        } as Response);
      }
      if (url.includes("/projects")) {
        return Promise.resolve(jsonResponse([]));
      }
      if (url.includes("/me/navigation")) {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse(meFixture()));
    }) as typeof fetch;

    const session = await getServerSession();

    expect(session?.systemStatus.release).toEqual({
      version: "1.2.3",
      commitShaShort: "abcdef1",
      deployedAt: "2026-01-01T00:00:00Z",
    });
  });

  it("leaves release: null when /health returns no build block", async () => {
    global.fetch = vi.fn((url: string) => {
      if (url.includes("/health")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            status: "ok",
            service: "dashboard-api",
            timestamp: "2026-01-01T00:00:00Z",
          }),
        } as Response);
      }
      if (url.includes("/projects")) {
        return Promise.resolve(jsonResponse([]));
      }
      if (url.includes("/me/navigation")) {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse(meFixture()));
    }) as typeof fetch;

    const session = await getServerSession();

    expect(session?.systemStatus.release).toBeNull();
  });
});
