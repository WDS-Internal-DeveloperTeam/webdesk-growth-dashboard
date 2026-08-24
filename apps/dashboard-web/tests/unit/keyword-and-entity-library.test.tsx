import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import type {
  EntityRecord,
  Keyword,
  KeywordEntityRelationship,
  PageKeywordAssignment,
} from "@webdesk/shared-types";
import {
  buildEntityLibraryHref,
  buildKeywordLibraryHref,
  getEntitiesForKeywordPicker,
  getEntity,
  getEntities,
  getKeyword,
  getKeywordEntityRelationships,
  getKeywords,
  getPageKeywordAssignments,
  getPagesForKeywordPicker,
  keywordApprovalStatusBadge,
  parseEntityLibrarySearchParams,
  parseKeywordLibrarySearchParams,
} from "../../lib/keyword-and-entity-library.js";

const PROJECT_ID = "99999999-9999-9999-9999-999999999999";
const KEYWORD_ID = "11111111-1111-1111-1111-111111111111";
const ENTITY_ID = "22222222-2222-2222-2222-222222222222";

function keywordFixture(id: string, overrides: Partial<Keyword> = {}): Keyword {
  return {
    id,
    projectId: PROJECT_ID,
    publicId: `KW-${id}`,
    queryText: "best seo tools",
    keywordType: null,
    intent: null,
    funnelStage: null,
    country: null,
    searchVolume: null,
    difficultyScore: null,
    source: null,
    researchDate: null,
    cannibalizationNotes: null,
    confidence: null,
    approvalStatus: "draft",
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
    ...overrides,
  };
}

function entityFixture(id: string, overrides: Partial<EntityRecord> = {}): EntityRecord {
  return {
    id,
    projectId: PROJECT_ID,
    publicId: `ENT-${id}`,
    name: "Acme Corp",
    entityType: "Organization",
    description: null,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
    ...overrides,
  };
}

describe("parseKeywordLibrarySearchParams", () => {
  it("defaults to no filters, offset 0, pageSize 20 when nothing is provided", () => {
    expect(parseKeywordLibrarySearchParams(PROJECT_ID, {})).toEqual({
      projectId: PROJECT_ID,
      keywordType: null,
      intent: null,
      funnelStage: null,
      country: null,
      confidence: null,
      approvalStatus: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("parses valid filter/offset/pageSize values", () => {
    expect(
      parseKeywordLibrarySearchParams(PROJECT_ID, {
        keywordType: "informational",
        intent: "research",
        funnelStage: "tofu",
        country: "US",
        confidence: "high",
        approvalStatus: "under_review",
        search: "seo tools",
        offset: "25",
        pageSize: "50",
      }),
    ).toEqual({
      projectId: PROJECT_ID,
      keywordType: "informational",
      intent: "research",
      funnelStage: "tofu",
      country: "US",
      confidence: "high",
      approvalStatus: "under_review",
      search: "seo tools",
      offset: 25,
      pageSize: 50,
    });
  });

  it("falls back to null for an invalid confidence/approvalStatus value instead of passing it through", () => {
    const result = parseKeywordLibrarySearchParams(PROJECT_ID, {
      confidence: "extreme",
      approvalStatus: "not_a_real_status",
    });
    expect(result.confidence).toBeNull();
    expect(result.approvalStatus).toBeNull();
  });

  it("clamps a negative offset to 0", () => {
    expect(parseKeywordLibrarySearchParams(PROJECT_ID, { offset: "-10" }).offset).toBe(0);
  });

  it("clamps an overlong short-text filter to 100 characters", () => {
    const overlong = "x".repeat(150);
    expect(
      parseKeywordLibrarySearchParams(PROJECT_ID, { keywordType: overlong }).keywordType,
    ).toHaveLength(100);
  });

  it("clamps an overlong search term to 500 characters", () => {
    const overlong = "x".repeat(600);
    expect(parseKeywordLibrarySearchParams(PROJECT_ID, { search: overlong }).search).toHaveLength(
      500,
    );
  });

  it("takes the first value when a param is duplicated in the URL", () => {
    expect(
      parseKeywordLibrarySearchParams(PROJECT_ID, { confidence: ["high", "low"] }).confidence,
    ).toBe("high");
  });
});

describe("buildKeywordLibraryHref", () => {
  const baseQuery = {
    projectId: PROJECT_ID,
    keywordType: null,
    intent: null,
    funnelStage: null,
    country: null,
    confidence: null,
    approvalStatus: null,
    search: null,
    offset: 0,
    pageSize: 20 as const,
  };

  it("always includes projectId, even with nothing else set", () => {
    expect(buildKeywordLibraryHref(baseQuery, {})).toBe(
      `/keyword-and-entity-library?projectId=${PROJECT_ID}`,
    );
  });

  it("includes filters and omits offset=0/the default pageSize", () => {
    expect(buildKeywordLibraryHref(baseQuery, { confidence: "high", search: "pricing" })).toBe(
      `/keyword-and-entity-library?projectId=${PROJECT_ID}&confidence=high&search=pricing`,
    );
  });

  it("resets offset to 0 when an override other than offset itself is applied", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildKeywordLibraryHref(withOffset, { approvalStatus: "draft" })).toBe(
      `/keyword-and-entity-library?projectId=${PROJECT_ID}&approvalStatus=draft`,
    );
  });

  it("keeps a nonzero offset when explicitly set", () => {
    expect(buildKeywordLibraryHref(baseQuery, { offset: 25 })).toBe(
      `/keyword-and-entity-library?projectId=${PROJECT_ID}&offset=25`,
    );
  });
});

describe("parseEntityLibrarySearchParams / buildEntityLibraryHref", () => {
  it("defaults to no filters, offset 0, pageSize 20", () => {
    expect(parseEntityLibrarySearchParams(PROJECT_ID, {})).toEqual({
      projectId: PROJECT_ID,
      entityType: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("parses entityType/search/offset/pageSize", () => {
    expect(
      parseEntityLibrarySearchParams(PROJECT_ID, {
        entityType: "Organization",
        search: "acme",
        offset: "10",
        pageSize: "30",
      }),
    ).toEqual({
      projectId: PROJECT_ID,
      entityType: "Organization",
      search: "acme",
      offset: 10,
      pageSize: 30,
    });
  });

  it("always includes projectId in the built href, and resets offset on a non-offset override", () => {
    const query = {
      projectId: PROJECT_ID,
      entityType: null,
      search: null,
      offset: 40,
      pageSize: 20 as const,
    };
    expect(buildEntityLibraryHref(query, { entityType: "Person" })).toBe(
      `/keyword-and-entity-library/entities?projectId=${PROJECT_ID}&entityType=Person`,
    );
  });
});

describe("keywordApprovalStatusBadge", () => {
  it("maps approved to healthy and rejected/archived/superseded to unavailable", () => {
    expect(keywordApprovalStatusBadge("approved").token).toBe("healthy");
    expect(keywordApprovalStatusBadge("rejected").token).toBe("unavailable");
    expect(keywordApprovalStatusBadge("archived").token).toBe("unavailable");
    expect(keywordApprovalStatusBadge("superseded").token).toBe("unavailable");
  });
});

describe("getKeywords", () => {
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
      getKeywords({
        projectId: PROJECT_ID,
        keywordType: null,
        intent: null,
        funnelStage: null,
        country: null,
        confidence: null,
        approvalStatus: null,
        search: null,
        offset: 0,
        pageSize: 20,
      }),
    ).rejects.toThrow(/Failed to load keywords/);
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

    await getKeywords({
      projectId: PROJECT_ID,
      keywordType: "informational",
      intent: null,
      funnelStage: null,
      country: null,
      confidence: "high",
      approvalStatus: null,
      search: null,
      offset: 25,
      pageSize: 20,
    });

    expect(requestedUrls[0]).toBe(
      `https://api.example.com/keyword-and-entity-library/projects/${PROJECT_ID}/keywords?keywordType=informational&confidence=high&limit=21&offset=25`,
    );
  });

  it("reports hasNextPage: true and trims the extra row when the backend returns one more than the page size", async () => {
    const items = Array.from({ length: 21 }, (_, i) => keywordFixture(`kw${i}`));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items, correlationId: "test" }),
    } as Response);

    const result = await getKeywords({
      projectId: PROJECT_ID,
      keywordType: null,
      intent: null,
      funnelStage: null,
      country: null,
      confidence: null,
      approvalStatus: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });

    expect(result.items).toHaveLength(20);
    expect(result.hasNextPage).toBe(true);
  });
});

describe("getKeyword", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    vi.mocked(cookies).mockResolvedValue({ toString: () => "sid=abc" } as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns null for a malformed projectId/keywordId without ever calling fetch", async () => {
    global.fetch = vi.fn() as typeof fetch;
    await expect(getKeyword("not-a-uuid", KEYWORD_ID)).resolves.toBeNull();
    await expect(getKeyword(PROJECT_ID, "not-a-uuid")).resolves.toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns null on a 404", async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 404, ok: false } as Response);
    await expect(getKeyword(PROJECT_ID, KEYWORD_ID)).resolves.toBeNull();
  });

  it("throws on a non-404 non-OK status", async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 500, ok: false } as Response);
    await expect(getKeyword(PROJECT_ID, KEYWORD_ID)).rejects.toThrow(/Failed to load keyword/);
  });

  it("returns the keyword on success", async () => {
    const keyword = keywordFixture(KEYWORD_ID);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: keyword, correlationId: "test" }),
    } as Response);
    await expect(getKeyword(PROJECT_ID, KEYWORD_ID)).resolves.toEqual(keyword);
  });
});

describe("getEntities / getEntity", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    vi.mocked(cookies).mockResolvedValue({ toString: () => "sid=abc" } as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("getEntities: throws on a non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(
      getEntities({
        projectId: PROJECT_ID,
        entityType: null,
        search: null,
        offset: 0,
        pageSize: 20,
      }),
    ).rejects.toThrow(/Failed to load entities/);
  });

  it("getEntities: requests the project-scoped route with one row past the chosen page size", async () => {
    const requestedUrls: string[] = [];
    global.fetch = vi.fn((url: string) => {
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [], correlationId: "test" }),
      } as Response);
    }) as typeof fetch;

    await getEntities({
      projectId: PROJECT_ID,
      entityType: "Organization",
      search: null,
      offset: 0,
      pageSize: 20,
    });

    expect(requestedUrls[0]).toBe(
      `https://api.example.com/keyword-and-entity-library/projects/${PROJECT_ID}/entities?entityType=Organization&limit=21&offset=0`,
    );
  });

  it("getEntity: returns null for a malformed id without ever calling fetch", async () => {
    global.fetch = vi.fn() as typeof fetch;
    await expect(getEntity(PROJECT_ID, "not-a-uuid")).resolves.toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("getEntity: returns null on a 404, throws on other non-OK, returns data on success", async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 404, ok: false } as Response);
    await expect(getEntity(PROJECT_ID, ENTITY_ID)).resolves.toBeNull();

    global.fetch = vi.fn().mockResolvedValue({ status: 500, ok: false } as Response);
    await expect(getEntity(PROJECT_ID, ENTITY_ID)).rejects.toThrow(/Failed to load entity/);

    const entity = entityFixture(ENTITY_ID);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: entity, correlationId: "test" }),
    } as Response);
    await expect(getEntity(PROJECT_ID, ENTITY_ID)).resolves.toEqual(entity);
  });
});

describe("getKeywordEntityRelationships / getPageKeywordAssignments", () => {
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

  it("getKeywordEntityRelationships: degrades to an empty array (never throws) on a malformed id, a 404, or any other non-OK status", async () => {
    global.fetch = vi.fn() as typeof fetch;
    await expect(getKeywordEntityRelationships("not-a-uuid", KEYWORD_ID)).resolves.toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();

    global.fetch = vi.fn().mockResolvedValue({ status: 404, ok: false } as Response);
    await expect(getKeywordEntityRelationships(PROJECT_ID, KEYWORD_ID)).resolves.toEqual([]);

    global.fetch = vi.fn().mockResolvedValue({ status: 500, ok: false } as Response);
    await expect(getKeywordEntityRelationships(PROJECT_ID, KEYWORD_ID)).resolves.toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });

  it("getKeywordEntityRelationships: returns the real data on success", async () => {
    const relationships: readonly KeywordEntityRelationship[] = [
      {
        id: "rel-1",
        keywordId: KEYWORD_ID,
        entityId: ENTITY_ID,
        createdBy: null,
        createdAt: "2026-08-24T00:00:00.000Z",
      },
    ];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: relationships, correlationId: "test" }),
    } as Response);
    await expect(getKeywordEntityRelationships(PROJECT_ID, KEYWORD_ID)).resolves.toEqual(
      relationships,
    );
  });

  it("getPageKeywordAssignments: degrades to an empty array on a malformed id, a 404, or any other non-OK status", async () => {
    global.fetch = vi.fn() as typeof fetch;
    await expect(getPageKeywordAssignments("not-a-uuid", KEYWORD_ID)).resolves.toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();

    global.fetch = vi.fn().mockResolvedValue({ status: 404, ok: false } as Response);
    await expect(getPageKeywordAssignments(PROJECT_ID, KEYWORD_ID)).resolves.toEqual([]);

    global.fetch = vi.fn().mockResolvedValue({ status: 500, ok: false } as Response);
    await expect(getPageKeywordAssignments(PROJECT_ID, KEYWORD_ID)).resolves.toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });

  it("getPageKeywordAssignments: returns the real data on success", async () => {
    const assignments: readonly PageKeywordAssignment[] = [
      {
        id: "assign-1",
        keywordId: KEYWORD_ID,
        pageId: "page-1",
        assignmentNote: "note",
        createdBy: null,
        createdAt: "2026-08-24T00:00:00.000Z",
      },
    ];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: assignments, correlationId: "test" }),
    } as Response);
    await expect(getPageKeywordAssignments(PROJECT_ID, KEYWORD_ID)).resolves.toEqual(assignments);
  });
});

describe("getEntitiesForKeywordPicker / getPagesForKeywordPicker", () => {
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

  it("getEntitiesForKeywordPicker: degrades to an empty array (never throws) when the underlying fetch fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(getEntitiesForKeywordPicker(PROJECT_ID)).resolves.toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });

  it("getEntitiesForKeywordPicker: returns up to 100 entities on success", async () => {
    const items = [entityFixture(ENTITY_ID)];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items, correlationId: "test" }),
    } as Response);
    await expect(getEntitiesForKeywordPicker(PROJECT_ID)).resolves.toEqual(items);
  });

  it("getPagesForKeywordPicker: degrades to an empty array (never throws) when the underlying fetch fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(getPagesForKeywordPicker(PROJECT_ID)).resolves.toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });
});
