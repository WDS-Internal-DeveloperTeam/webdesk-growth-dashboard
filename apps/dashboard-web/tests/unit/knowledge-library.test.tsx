import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import type { KnowledgeLibraryRecord } from "@webdesk/shared-types";
import {
  buildKnowledgeLibraryHref,
  getKnowledgeLibraryRecord,
  getKnowledgeLibraryRecords,
  knowledgeLibraryConfidentialityBadge,
  knowledgeLibraryStatusBadge,
  parseKnowledgeLibrarySearchParams,
} from "../../lib/knowledge-library.js";

describe("parseKnowledgeLibrarySearchParams", () => {
  it("defaults to no filters, offset 0, pageSize 20 when nothing is provided", () => {
    expect(parseKnowledgeLibrarySearchParams({})).toEqual({
      status: null,
      confidentiality: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("parses valid status/confidentiality/search/offset/pageSize values", () => {
    expect(
      parseKnowledgeLibrarySearchParams({
        status: "advisory",
        confidentiality: "restricted",
        search: "onboarding",
        offset: "25",
        pageSize: "50",
      }),
    ).toEqual({
      status: "advisory",
      confidentiality: "restricted",
      search: "onboarding",
      offset: 25,
      pageSize: 50,
    });
  });

  it("falls back to defaults for invalid/garbled enum values instead of passing them through", () => {
    expect(
      parseKnowledgeLibrarySearchParams({
        status: "not_a_real_status",
        confidentiality: "top_secret",
        offset: "not-a-number",
        pageSize: "37",
      }),
    ).toEqual({
      status: null,
      confidentiality: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("clamps a negative offset to 0", () => {
    expect(parseKnowledgeLibrarySearchParams({ offset: "-10" }).offset).toBe(0);
  });

  it("clamps an overlong search term to 255 characters", () => {
    const overlong = "x".repeat(300);
    expect(parseKnowledgeLibrarySearchParams({ search: overlong }).search).toHaveLength(255);
  });

  it("takes the first value when a param is duplicated in the URL", () => {
    expect(parseKnowledgeLibrarySearchParams({ status: ["draft", "advisory"] }).status).toBe(
      "draft",
    );
  });
});

describe("buildKnowledgeLibraryHref", () => {
  const baseQuery = {
    status: null,
    confidentiality: null,
    search: null,
    offset: 0,
    pageSize: 20 as const,
  };

  it("returns the bare path when nothing is set", () => {
    expect(buildKnowledgeLibraryHref(baseQuery, {})).toBe("/knowledge-library");
  });

  it("includes status/confidentiality/search and omits offset=0/the default pageSize", () => {
    expect(
      buildKnowledgeLibraryHref(baseQuery, {
        status: "draft",
        confidentiality: "internal",
        search: "wiki",
      }),
    ).toBe("/knowledge-library?status=draft&confidentiality=internal&search=wiki");
  });

  it("resets offset to 0 when an override other than offset itself is applied", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildKnowledgeLibraryHref(withOffset, { status: "mandatory" })).toBe(
      "/knowledge-library?status=mandatory",
    );
  });

  it("keeps a nonzero offset when explicitly set", () => {
    expect(buildKnowledgeLibraryHref(baseQuery, { offset: 25 })).toBe(
      "/knowledge-library?offset=25",
    );
  });

  it("includes a non-default pageSize and resets offset to 0", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildKnowledgeLibraryHref(withOffset, { pageSize: 50 })).toBe(
      "/knowledge-library?pageSize=50",
    );
  });
});

describe("knowledgeLibraryStatusBadge", () => {
  it("maps mandatory and advisory to the same healthy token, disambiguated by label", () => {
    expect(knowledgeLibraryStatusBadge("mandatory")).toEqual({
      token: "healthy",
      label: "Mandatory",
    });
    expect(knowledgeLibraryStatusBadge("advisory")).toEqual({
      token: "healthy",
      label: "Advisory",
    });
  });

  it("maps draft to unknown and deprecated to notConfigured", () => {
    expect(knowledgeLibraryStatusBadge("draft").token).toBe("unknown");
    expect(knowledgeLibraryStatusBadge("deprecated").token).toBe("notConfigured");
  });
});

describe("knowledgeLibraryConfidentialityBadge", () => {
  it("maps restricted to degraded", () => {
    expect(knowledgeLibraryConfidentialityBadge("restricted")).toEqual({
      token: "degraded",
      label: "Restricted",
    });
  });

  it("maps public to healthy and internal to unknown", () => {
    expect(knowledgeLibraryConfidentialityBadge("public").token).toBe("healthy");
    expect(knowledgeLibraryConfidentialityBadge("internal").token).toBe("unknown");
  });
});

function recordFixture(
  id: string,
  overrides: Partial<KnowledgeLibraryRecord> = {},
): KnowledgeLibraryRecord {
  return {
    id,
    title: "Reference doc",
    sourceType: "internal_wiki",
    location: "https://wiki.internal.example/page",
    ownerUserId: null,
    sourceDate: null,
    confidentiality: "internal",
    approvedForAgentUse: false,
    status: "draft",
    notes: null,
    relatedEntityIds: [],
    version: 1,
    lastReviewedAt: null,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("getKnowledgeLibraryRecords", () => {
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
      getKnowledgeLibraryRecords({
        status: null,
        confidentiality: null,
        search: null,
        offset: 0,
        pageSize: 20,
      }),
    ).rejects.toThrow(/Failed to load knowledge library records/);
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

    await getKnowledgeLibraryRecords({
      status: "draft",
      confidentiality: "restricted",
      search: "wiki",
      offset: 25,
      pageSize: 20,
    });

    expect(requestedUrls[0]).toBe(
      "https://api.example.com/knowledge-library/records?status=draft&confidentiality=restricted&search=wiki&limit=21&offset=25",
    );
  });

  it("reports hasNextPage: true and trims the extra row when the backend returns one more than the page size", async () => {
    const items = Array.from({ length: 21 }, (_, i) => recordFixture(`r${i}`));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items, correlationId: "test" }),
    } as Response);

    const result = await getKnowledgeLibraryRecords({
      status: null,
      confidentiality: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });

    expect(result.items).toHaveLength(20);
    expect(result.hasNextPage).toBe(true);
  });
});

describe("getKnowledgeLibraryRecord", () => {
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
    const result = await getKnowledgeLibraryRecord("not-a-uuid");
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns null on a 404", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    const result = await getKnowledgeLibraryRecord(VALID_ID);
    expect(result).toBeNull();
  });

  it("throws on a non-404 non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(getKnowledgeLibraryRecord(VALID_ID)).rejects.toThrow(
      /Failed to load knowledge library record/,
    );
  });

  it("returns the record on success, including a redacted (undefined) notes field", async () => {
    const record = recordFixture(VALID_ID, {
      confidentiality: "restricted",
      sourceType: undefined,
      location: undefined,
      notes: undefined,
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: record, correlationId: "test" }),
    } as Response);

    const result = await getKnowledgeLibraryRecord(VALID_ID);
    expect(result?.notes).toBeUndefined();
    expect(result?.sourceType).toBeUndefined();
  });
});
