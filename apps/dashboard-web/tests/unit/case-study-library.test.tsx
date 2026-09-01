import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import type { CaseStudy, CaseStudyLibraryRecordWithCaseStudy } from "@webdesk/shared-types";
import {
  buildCaseStudyLibraryHref,
  parseCaseStudyLibrarySearchParams,
} from "../../lib/case-study-library-query.js";
import {
  getCaseStudyLibraryRecord,
  getCaseStudyLibraryRecords,
} from "../../lib/case-study-library.js";

describe("parseCaseStudyLibrarySearchParams", () => {
  it("defaults to no filters, offset 0, pageSize 20 when nothing is provided", () => {
    expect(parseCaseStudyLibrarySearchParams({})).toEqual({
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("parses valid search/offset/pageSize values", () => {
    expect(
      parseCaseStudyLibrarySearchParams({ search: "CSL-1", offset: "25", pageSize: "50" }),
    ).toEqual({ search: "CSL-1", offset: 25, pageSize: 50 });
  });

  it("falls back to defaults for invalid offset/pageSize values", () => {
    expect(parseCaseStudyLibrarySearchParams({ offset: "not-a-number", pageSize: "37" })).toEqual({
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("clamps a negative offset to 0", () => {
    expect(parseCaseStudyLibrarySearchParams({ offset: "-10" }).offset).toBe(0);
  });

  it("clamps an overlong search term to 255 characters", () => {
    const overlong = "x".repeat(300);
    expect(parseCaseStudyLibrarySearchParams({ search: overlong }).search).toHaveLength(255);
  });

  it("takes the first value when a param is duplicated in the URL", () => {
    expect(parseCaseStudyLibrarySearchParams({ search: ["a", "b"] }).search).toBe("a");
  });
});

describe("buildCaseStudyLibraryHref", () => {
  const baseQuery = { search: null, offset: 0, pageSize: 20 as const };

  it("returns the bare path when nothing is set", () => {
    expect(buildCaseStudyLibraryHref(baseQuery, {})).toBe("/case-study-library");
  });

  it("includes search and omits offset=0/the default pageSize", () => {
    expect(buildCaseStudyLibraryHref(baseQuery, { search: "CSL-1" })).toBe(
      "/case-study-library?search=CSL-1",
    );
  });

  it("resets offset to 0 when an override other than offset itself is applied", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildCaseStudyLibraryHref(withOffset, { search: "hero" })).toBe(
      "/case-study-library?search=hero",
    );
  });

  it("keeps a nonzero offset when explicitly set", () => {
    expect(buildCaseStudyLibraryHref(baseQuery, { offset: 25 })).toBe(
      "/case-study-library?offset=25",
    );
  });

  it("includes a non-default pageSize and resets offset to 0", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildCaseStudyLibraryHref(withOffset, { pageSize: 50 })).toBe(
      "/case-study-library?pageSize=50",
    );
  });
});

function caseStudyFixture(id: string, overrides: Partial<CaseStudy> = {}): CaseStudy {
  return {
    id,
    publicId: `CS-${id}`,
    clientName: "Acme",
    projectTitle: "Website Rebuild",
    industry: null,
    platform: null,
    visibility: "public",
    embargoDate: null,
    challenge: null,
    solution: null,
    implementation: null,
    results: null,
    relatedServiceIds: [],
    relatedClaimIds: [],
    assignedReviewerUserId: null,
    clientApprovalRequired: false,
    status: "published",
    scheduledPublishAt: null,
    publishedAt: null,
    unpublishReason: null,
    version: 1,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

function recordFixture(
  id: string,
  overrides: Partial<CaseStudyLibraryRecordWithCaseStudy> = {},
): CaseStudyLibraryRecordWithCaseStudy {
  return {
    id,
    publicId: `CSL-${id}`,
    caseStudyId: "cs-1",
    relatedPageIds: [],
    technologies: [],
    testimonials: [],
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    caseStudy: caseStudyFixture("cs-1"),
    ...overrides,
  };
}

describe("getCaseStudyLibraryRecords", () => {
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
      getCaseStudyLibraryRecords({ search: null, offset: 0, pageSize: 20 }),
    ).rejects.toThrow(/Failed to load case study library records/);
  });

  it("requests pageSize+1 rows and reports hasNextPage when an extra row comes back", async () => {
    const records = Array.from({ length: 11 }, (_, i) => recordFixture(String(i)));
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: records, correlationId: "x" }),
    } as Response);
    global.fetch = fetchMock;

    const result = await getCaseStudyLibraryRecords({ search: null, offset: 0, pageSize: 10 });

    expect(result.items).toHaveLength(10);
    expect(result.hasNextPage).toBe(true);
    const requestedUrl = fetchMock.mock.calls[0]![0] as string;
    expect(requestedUrl).toContain("limit=11");
  });
});

describe("getCaseStudyLibraryRecord", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    vi.mocked(cookies).mockResolvedValue({ toString: () => "sid=abc" } as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns null for a malformed id without making a network call", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock;
    expect(await getCaseStudyLibraryRecord("not-a-uuid")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null on a 404", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getCaseStudyLibraryRecord("11111111-1111-1111-1111-111111111111")).toBeNull();
  });

  it("throws on a non-404 non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(getCaseStudyLibraryRecord("11111111-1111-1111-1111-111111111111")).rejects.toThrow(
      /Failed to load case study library record/,
    );
  });

  it("returns the record, including its nested parent case study, on success", async () => {
    const record = recordFixture("1", {
      relatedPageIds: ["22222222-2222-2222-2222-222222222222"],
      technologies: ["Next.js"],
      testimonials: [{ quote: "Great work!", author: "Jane", role: "CTO" }],
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: record, correlationId: "x" }),
    } as Response);

    const result = await getCaseStudyLibraryRecord("11111111-1111-1111-1111-111111111111");
    expect(result).toEqual(record);
    expect(result?.caseStudy?.clientName).toBe("Acme");
  });
});
