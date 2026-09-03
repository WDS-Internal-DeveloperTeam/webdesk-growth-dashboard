import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import type { Release, RollbackRecord } from "@webdesk/shared-types";
import {
  buildReleasesHref,
  getRelease,
  getReleaseRollbackRecord,
  getReleases,
  parseReleasesSearchParams,
  releaseStatusBadge,
} from "../../lib/release-center.js";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const RELEASE_ID = "22222222-2222-2222-2222-222222222222";

function releaseFixture(overrides: Partial<Release> = {}): Release {
  return {
    id: RELEASE_ID,
    projectId: PROJECT_ID,
    publicId: "REL-1",
    releaseType: "staging",
    title: "Release the homepage redesign",
    status: "proposed",
    notes: null,
    hotfixReason: null,
    assignedDeveloperUserId: null,
    assignedReviewerUserId: null,
    productionApproverUserId: null,
    stagingDeployedAt: null,
    stagingVerifiedAt: null,
    productionDeployedAt: null,
    productionVerifiedAt: null,
    completedAt: null,
    hotfixRequiredAt: null,
    rolledBackAt: null,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-09-02T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("parseReleasesSearchParams", () => {
  it("defaults to no filters, offset 0, pageSize 20 when nothing is provided", () => {
    expect(parseReleasesSearchParams(PROJECT_ID, {})).toEqual({
      projectId: PROJECT_ID,
      releaseType: null,
      status: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("parses valid releaseType/status/search/offset/pageSize values", () => {
    expect(
      parseReleasesSearchParams(PROJECT_ID, {
        releaseType: "hotfix",
        status: "checks_running",
        search: "homepage",
        offset: "40",
        pageSize: "50",
      }),
    ).toEqual({
      projectId: PROJECT_ID,
      releaseType: "hotfix",
      status: "checks_running",
      search: "homepage",
      offset: 40,
      pageSize: 50,
    });
  });

  it("falls back to null for an unrecognized releaseType/status, and to defaults for a negative/garbled offset", () => {
    expect(
      parseReleasesSearchParams(PROJECT_ID, {
        releaseType: "not_a_real_type",
        status: "not_a_real_status",
        offset: "-5",
      }),
    ).toEqual({
      projectId: PROJECT_ID,
      releaseType: null,
      status: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("clamps search to 255 characters", () => {
    const long = "a".repeat(300);
    expect(parseReleasesSearchParams(PROJECT_ID, { search: long }).search).toHaveLength(255);
  });
});

describe("buildReleasesHref", () => {
  const base = parseReleasesSearchParams(PROJECT_ID, {});

  it("always includes projectId first", () => {
    expect(buildReleasesHref(base, {})).toBe(`/release-center?projectId=${PROJECT_ID}`);
  });

  it("resets offset to 0 when a non-offset field changes", () => {
    const withOffset = { ...base, offset: 40 };
    expect(buildReleasesHref(withOffset, { status: "completed" })).toBe(
      `/release-center?projectId=${PROJECT_ID}&status=completed`,
    );
  });

  it("preserves an explicit offset override", () => {
    expect(buildReleasesHref(base, { offset: 20 })).toBe(
      `/release-center?projectId=${PROJECT_ID}&offset=20`,
    );
  });

  it("only sets pageSize when it differs from the default", () => {
    expect(buildReleasesHref(base, { pageSize: 20 })).not.toContain("pageSize");
    expect(buildReleasesHref(base, { pageSize: 50 })).toContain("pageSize=50");
  });
});

describe("releaseStatusBadge", () => {
  it("maps every ReleaseStatus to a token/label pair", () => {
    expect(releaseStatusBadge("proposed")).toEqual({ token: "notConfigured", label: "Proposed" });
    expect(releaseStatusBadge("completed")).toEqual({ token: "healthy", label: "Completed" });
    expect(releaseStatusBadge("checks_failed").token).toBe("unavailable");
    expect(releaseStatusBadge("rolled_back").token).toBe("unavailable");
    expect(releaseStatusBadge("staging_deployed").token).toBe("degraded");
  });
});

describe("getReleases", () => {
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
    await expect(getReleases(parseReleasesSearchParams(PROJECT_ID, {}))).rejects.toThrow(
      /status 500/,
    );
  });

  it("requests pageSize + 1 rows and slices/flags hasNextPage from the extra row", async () => {
    const pageSize = 10;
    const items = Array.from({ length: pageSize + 1 }, (_, index) =>
      releaseFixture({ id: String(index + 1) }),
    );
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items, correlationId: "c1" }),
    } as Response);

    const result = await getReleases(
      parseReleasesSearchParams(PROJECT_ID, { pageSize: String(pageSize) }),
    );

    expect(result.items).toHaveLength(pageSize);
    expect(result.hasNextPage).toBe(true);
    const [url] = vi.mocked(global.fetch).mock.calls[0] as [string];
    expect(url).toContain(`/release-center/projects/${PROJECT_ID}/releases?`);
    expect(url).toContain(`limit=${pageSize + 1}`);
  });
});

describe("getRelease", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    vi.mocked(cookies).mockResolvedValue({ toString: () => "sid=abc" } as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns null for a malformed projectId/releaseId without issuing a network call", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;
    expect(await getRelease("not-a-uuid", RELEASE_ID)).toBeNull();
    expect(await getRelease(PROJECT_ID, "not-a-uuid")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null on a 404", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getRelease(PROJECT_ID, RELEASE_ID)).toBeNull();
  });

  it("throws on a non-404 non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(getRelease(PROJECT_ID, RELEASE_ID)).rejects.toThrow(/status 500/);
  });

  it("returns the release on success", async () => {
    const release = releaseFixture();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: release, correlationId: "c1" }),
    } as Response);
    expect(await getRelease(PROJECT_ID, RELEASE_ID)).toEqual(release);
  });
});

describe("getReleaseRollbackRecord", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    vi.mocked(cookies).mockResolvedValue({ toString: () => "sid=abc" } as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("degrades to null on a malformed id, a 404 (never having been rolled back), or a non-OK status — never throws", async () => {
    global.fetch = vi.fn() as typeof fetch;
    expect(await getReleaseRollbackRecord("not-a-uuid", RELEASE_ID)).toBeNull();

    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getReleaseRollbackRecord(PROJECT_ID, RELEASE_ID)).toBeNull();

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    expect(await getReleaseRollbackRecord(PROJECT_ID, RELEASE_ID)).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("returns the rollback record on success", async () => {
    const record: RollbackRecord = {
      id: "33333333-3333-3333-3333-333333333333",
      releaseId: RELEASE_ID,
      projectId: PROJECT_ID,
      rolledBackSha: "abc1234",
      reason: "Bad deploy",
      replacementReleaseId: null,
      rolledBackByUserId: null,
      rolledBackAt: "2026-09-02T00:00:00.000Z",
      createdAt: "2026-09-02T00:00:00.000Z",
      updatedAt: "2026-09-02T00:00:00.000Z",
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: record, correlationId: "c1" }),
    } as Response);
    expect(await getReleaseRollbackRecord(PROJECT_ID, RELEASE_ID)).toEqual(record);
  });
});
