import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import type { DesignTokenRecord } from "@webdesk/shared-types";
import {
  buildDesignTokenLibraryHref,
  designTokenApprovalStatusBadge,
  getDesignToken,
  getDesignTokens,
  getDesignTokenVersions,
  parseDesignTokenLibrarySearchParams,
} from "../../lib/design-token-library.js";

function tokenFixture(id: string, overrides: Partial<DesignTokenRecord> = {}): DesignTokenRecord {
  return {
    id,
    recordId: id,
    publicId: `DTL-${id}`,
    group: "colors",
    versionNumber: 1,
    isCurrent: true,
    name: "Primary Brand Blue",
    value: "#1D4ED8",
    unit: null,
    semanticPurpose: null,
    responsiveVariation: null,
    themeVariation: null,
    usageReferences: [],
    approvalStatus: "draft",
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-23T00:00:00.000Z",
    updatedAt: "2026-08-23T00:00:00.000Z",
    ...overrides,
  };
}

describe("parseDesignTokenLibrarySearchParams", () => {
  it("defaults to no filters, offset 0, pageSize 20 when nothing is provided", () => {
    expect(parseDesignTokenLibrarySearchParams({})).toEqual({
      group: null,
      approvalStatus: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("parses valid group/approvalStatus/search/offset/pageSize values", () => {
    expect(
      parseDesignTokenLibrarySearchParams({
        group: "typography",
        approvalStatus: "under_review",
        search: "font",
        offset: "25",
        pageSize: "50",
      }),
    ).toEqual({
      group: "typography",
      approvalStatus: "under_review",
      search: "font",
      offset: 25,
      pageSize: 50,
    });
  });

  it("falls back to defaults for invalid/garbled enum values instead of passing them through", () => {
    expect(
      parseDesignTokenLibrarySearchParams({
        group: "not_a_real_group",
        approvalStatus: "not_a_real_status",
        offset: "not-a-number",
        pageSize: "37",
      }),
    ).toEqual({
      group: null,
      approvalStatus: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("clamps a negative offset to 0", () => {
    expect(parseDesignTokenLibrarySearchParams({ offset: "-10" }).offset).toBe(0);
  });

  it("clamps an overlong search term to 255 characters", () => {
    const overlong = "x".repeat(300);
    expect(parseDesignTokenLibrarySearchParams({ search: overlong }).search).toHaveLength(255);
  });

  it("takes the first value when a param is duplicated in the URL", () => {
    expect(parseDesignTokenLibrarySearchParams({ group: ["colors", "typography"] }).group).toBe(
      "colors",
    );
  });
});

describe("buildDesignTokenLibraryHref", () => {
  const baseQuery = {
    group: null,
    approvalStatus: null,
    search: null,
    offset: 0,
    pageSize: 20 as const,
  };

  it("returns the bare path when nothing is set", () => {
    expect(buildDesignTokenLibraryHref(baseQuery, {})).toBe("/design-token-library");
  });

  it("includes group/approvalStatus/search and omits offset=0/the default pageSize", () => {
    expect(
      buildDesignTokenLibraryHref(baseQuery, {
        group: "spacing",
        approvalStatus: "draft",
        search: "gutter",
      }),
    ).toBe("/design-token-library?group=spacing&approvalStatus=draft&search=gutter");
  });

  it("resets offset to 0 when an override other than offset itself is applied", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildDesignTokenLibraryHref(withOffset, { approvalStatus: "approved" })).toBe(
      "/design-token-library?approvalStatus=approved",
    );
  });

  it("keeps a nonzero offset when explicitly set", () => {
    expect(buildDesignTokenLibraryHref(baseQuery, { offset: 25 })).toBe(
      "/design-token-library?offset=25",
    );
  });

  it("includes a non-default pageSize and resets offset to 0", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildDesignTokenLibraryHref(withOffset, { pageSize: 50 })).toBe(
      "/design-token-library?pageSize=50",
    );
  });
});

describe("designTokenApprovalStatusBadge", () => {
  it("maps under_review and revision_requested to the same degraded token, disambiguated by label", () => {
    expect(designTokenApprovalStatusBadge("under_review")).toEqual({
      token: "degraded",
      label: "Under Review",
    });
    expect(designTokenApprovalStatusBadge("revision_requested")).toEqual({
      token: "degraded",
      label: "Revision Requested",
    });
  });

  it("maps approved to healthy and rejected to unavailable", () => {
    expect(designTokenApprovalStatusBadge("approved").token).toBe("healthy");
    expect(designTokenApprovalStatusBadge("rejected").token).toBe("unavailable");
  });
});

describe("getDesignTokens", () => {
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
      getDesignTokens({
        group: null,
        approvalStatus: null,
        search: null,
        offset: 0,
        pageSize: 20,
      }),
    ).rejects.toThrow(/Failed to load design tokens/);
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

    await getDesignTokens({
      group: "colors",
      approvalStatus: "draft",
      search: "blue",
      offset: 25,
      pageSize: 20,
    });

    expect(requestedUrls[0]).toBe(
      "https://api.example.com/design-token-library/tokens?group=colors&approvalStatus=draft&search=blue&limit=21&offset=25",
    );
  });

  it("reports hasNextPage: true and trims the extra row when the backend returns one more than the page size", async () => {
    const items = Array.from({ length: 21 }, (_, i) => tokenFixture(`t${i}`));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items, correlationId: "test" }),
    } as Response);

    const result = await getDesignTokens({
      group: null,
      approvalStatus: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });

    expect(result.items).toHaveLength(20);
    expect(result.hasNextPage).toBe(true);
  });
});

describe("getDesignToken", () => {
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
    const result = await getDesignToken("not-a-uuid");
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns null on a 404", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getDesignToken(VALID_ID)).toBeNull();
  });

  it("throws on a non-404 non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response);
    await expect(getDesignToken(VALID_ID)).rejects.toThrow(/Failed to load design token/);
  });

  it("returns the token on a 200", async () => {
    const token = tokenFixture(VALID_ID, { name: "Secondary Brand Green" });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: token, correlationId: "test" }),
    } as Response);

    const result = await getDesignToken(VALID_ID);
    expect(result?.id).toBe(VALID_ID);
    expect(result?.name).toBe("Secondary Brand Green");
  });
});

describe("getDesignTokenVersions", () => {
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

  it("returns an empty array for a malformed id without ever calling fetch", async () => {
    global.fetch = vi.fn() as typeof fetch;
    expect(await getDesignTokenVersions("not-a-uuid")).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns an empty array on a 404 instead of throwing", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getDesignTokenVersions(VALID_ID)).toEqual([]);
  });

  it("throws on a non-404 non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(getDesignTokenVersions(VALID_ID)).rejects.toThrow(
      /Failed to load design token versions/,
    );
  });

  it("requests the /versions route and returns every version, oldest first (the backend's own order, unmodified)", async () => {
    const requestedUrls: string[] = [];
    const versions = [
      tokenFixture("v1", { versionNumber: 1 }),
      tokenFixture("v2", { versionNumber: 2 }),
    ];
    global.fetch = vi.fn((url: string) => {
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: versions, correlationId: "test" }),
      } as Response);
    }) as typeof fetch;

    const result = await getDesignTokenVersions(VALID_ID);

    expect(requestedUrls[0]).toBe(
      `https://api.example.com/design-token-library/tokens/${VALID_ID}/versions`,
    );
    expect(result.map((v) => v.versionNumber)).toEqual([1, 2]);
  });
});
