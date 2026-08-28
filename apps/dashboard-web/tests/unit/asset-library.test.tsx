import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import type { Asset } from "@webdesk/shared-types";
import {
  assetApprovalStatusBadge,
  assetPublishBadge,
  assetScanStatusBadge,
  assetVisibilityBadge,
  buildAssetLibraryHref,
  getAsset,
  getAssetRelatedRecords,
  getAssets,
  parseAssetLibrarySearchParams,
} from "../../lib/asset-library.js";

describe("parseAssetLibrarySearchParams", () => {
  it("defaults to no filters, offset 0, pageSize 20 when nothing is provided", () => {
    expect(parseAssetLibrarySearchParams({})).toEqual({
      approvalStatus: null,
      visibility: null,
      scanStatus: null,
      isPublished: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("parses valid approvalStatus/visibility/scanStatus/isPublished/search/offset/pageSize values", () => {
    expect(
      parseAssetLibrarySearchParams({
        approvalStatus: "under_review",
        visibility: "restricted",
        scanStatus: "pending",
        isPublished: "true",
        search: "hero",
        offset: "25",
        pageSize: "50",
      }),
    ).toEqual({
      approvalStatus: "under_review",
      visibility: "restricted",
      scanStatus: "pending",
      isPublished: true,
      search: "hero",
      offset: 25,
      pageSize: 50,
    });
  });

  it("parses isPublished=false as literal false, not falling through to null", () => {
    expect(parseAssetLibrarySearchParams({ isPublished: "false" }).isPublished).toBe(false);
  });

  it("falls back to defaults for invalid/garbled enum values instead of passing them through", () => {
    expect(
      parseAssetLibrarySearchParams({
        approvalStatus: "not_a_real_status",
        visibility: "not_a_real_visibility",
        scanStatus: "not_a_real_scan_status",
        isPublished: "maybe",
        offset: "not-a-number",
      }),
    ).toEqual({
      approvalStatus: null,
      visibility: null,
      scanStatus: null,
      isPublished: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("clamps a negative offset to 0", () => {
    expect(parseAssetLibrarySearchParams({ offset: "-10" }).offset).toBe(0);
  });

  it("clamps an overlong search term to 255 characters", () => {
    const overlong = "x".repeat(300);
    expect(parseAssetLibrarySearchParams({ search: overlong }).search).toHaveLength(255);
  });

  it("takes the first value when a param is duplicated in the URL", () => {
    expect(parseAssetLibrarySearchParams({ visibility: ["restricted", "public"] }).visibility).toBe(
      "restricted",
    );
  });
});

describe("buildAssetLibraryHref", () => {
  const baseQuery = {
    approvalStatus: null,
    visibility: null,
    scanStatus: null,
    isPublished: null,
    search: null,
    offset: 0,
    pageSize: 20 as const,
  };

  it("returns the bare path when nothing is set", () => {
    expect(buildAssetLibraryHref(baseQuery, {})).toBe("/asset-library");
  });

  it("includes approvalStatus/visibility/scanStatus/isPublished/search and omits offset=0/the default pageSize", () => {
    expect(
      buildAssetLibraryHref(baseQuery, {
        approvalStatus: "draft",
        visibility: "internal",
        scanStatus: "not_configured",
        isPublished: true,
        search: "hero",
      }),
    ).toBe(
      "/asset-library?approvalStatus=draft&visibility=internal&scanStatus=not_configured&isPublished=true&search=hero",
    );
  });

  it("includes isPublished=false explicitly rather than omitting it", () => {
    expect(buildAssetLibraryHref(baseQuery, { isPublished: false })).toBe(
      "/asset-library?isPublished=false",
    );
  });

  it("resets offset to 0 when an override other than offset itself is applied", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildAssetLibraryHref(withOffset, { approvalStatus: "approved" })).toBe(
      "/asset-library?approvalStatus=approved",
    );
  });

  it("keeps a nonzero offset when explicitly set", () => {
    expect(buildAssetLibraryHref(baseQuery, { offset: 25 })).toBe("/asset-library?offset=25");
  });
});

describe("assetApprovalStatusBadge", () => {
  it("maps under_review and revision_requested to the same degraded token, disambiguated by label", () => {
    expect(assetApprovalStatusBadge("under_review")).toEqual({
      token: "degraded",
      label: "Under Review",
    });
    expect(assetApprovalStatusBadge("revision_requested")).toEqual({
      token: "degraded",
      label: "Revision Requested",
    });
  });

  it("maps approved to healthy and rejected to unavailable", () => {
    expect(assetApprovalStatusBadge("approved").token).toBe("healthy");
    expect(assetApprovalStatusBadge("rejected").token).toBe("unavailable");
  });
});

describe("assetPublishBadge", () => {
  it("maps published to healthy and unpublished to notConfigured", () => {
    expect(assetPublishBadge(true)).toEqual({ token: "healthy", label: "Published" });
    expect(assetPublishBadge(false)).toEqual({ token: "notConfigured", label: "Unpublished" });
  });
});

describe("assetVisibilityBadge", () => {
  it("gives restricted its own distinct degraded token", () => {
    expect(assetVisibilityBadge("restricted")).toEqual({ token: "degraded", label: "Restricted" });
  });

  it("gives public and internal the same neutral unknown token", () => {
    expect(assetVisibilityBadge("public").token).toBe("unknown");
    expect(assetVisibilityBadge("internal").token).toBe("unknown");
  });
});

describe("assetScanStatusBadge", () => {
  it("treats not_configured as neutral, not degraded — an honest absence, not a problem", () => {
    expect(assetScanStatusBadge("not_configured")).toEqual({
      token: "unknown",
      label: "Scan Not Configured",
    });
  });

  it("flags infected and failed as unavailable", () => {
    expect(assetScanStatusBadge("infected").token).toBe("unavailable");
    expect(assetScanStatusBadge("failed").token).toBe("unavailable");
  });

  it("flags pending as degraded, in progress", () => {
    expect(assetScanStatusBadge("pending").token).toBe("degraded");
  });
});

function assetFixture(id: string, overrides: Partial<Asset> = {}): Asset {
  return {
    id,
    publicId: `ASSET-${id}`,
    title: "Homepage hero image",
    description: null,
    fileReference: null,
    mimeType: null,
    fileSizeBytes: null,
    checksum: null,
    widthPx: null,
    heightPx: null,
    durationSeconds: null,
    licence: null,
    licenceHolder: null,
    consentReference: null,
    altTextGuidance: null,
    visibility: "internal",
    retentionNote: null,
    scanStatus: "not_configured",
    approvalStatus: "draft",
    version: 1,
    isPublished: false,
    publishedAt: null,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-28T00:00:00.000Z",
    updatedAt: "2026-08-28T00:00:00.000Z",
    ...overrides,
  };
}

describe("getAssets", () => {
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
      getAssets({
        approvalStatus: null,
        visibility: null,
        scanStatus: null,
        isPublished: null,
        search: null,
        offset: 0,
        pageSize: 20,
      }),
    ).rejects.toThrow(/Failed to load assets/);
  });

  it("requests one row past the chosen page size, including approvalStatus/visibility/scanStatus/isPublished", async () => {
    const requestedUrls: string[] = [];
    global.fetch = vi.fn((url: string) => {
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [], correlationId: "test" }),
      } as Response);
    }) as typeof fetch;

    await getAssets({
      approvalStatus: "draft",
      visibility: "restricted",
      scanStatus: "pending",
      isPublished: true,
      search: "hero",
      offset: 25,
      pageSize: 20,
    });

    expect(requestedUrls[0]).toBe(
      "https://api.example.com/asset-library/assets?approvalStatus=draft&visibility=restricted&scanStatus=pending&isPublished=true&search=hero&limit=21&offset=25",
    );
  });

  it("reports hasNextPage: true and trims the extra row when the backend returns one more than the page size", async () => {
    const items = Array.from({ length: 21 }, (_, i) => assetFixture(`a${i}`));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items, correlationId: "test" }),
    } as Response);

    const result = await getAssets({
      approvalStatus: null,
      visibility: null,
      scanStatus: null,
      isPublished: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });

    expect(result.items).toHaveLength(20);
    expect(result.hasNextPage).toBe(true);
  });
});

describe("getAsset", () => {
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
    const result = await getAsset("not-a-uuid");
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns null on a 404", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getAsset(VALID_ID)).toBeNull();
  });

  it("throws on a non-404 non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response);
    await expect(getAsset(VALID_ID)).rejects.toThrow(/Failed to load asset/);
  });

  it("returns the asset on a 200", async () => {
    const asset = assetFixture(VALID_ID, { fileReference: "https://cdn.example.com/hero.png" });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: asset, correlationId: "test" }),
    } as Response);

    const result = await getAsset(VALID_ID);
    expect(result?.id).toBe(VALID_ID);
    expect(result?.fileReference).toBe("https://cdn.example.com/hero.png");
  });
});

describe("getAssetRelatedRecords", () => {
  const originalFetch = global.fetch;
  const ASSET_ID = "11111111-1111-1111-1111-111111111111";

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    vi.mocked(cookies).mockResolvedValue({ toString: () => "sid=abc" } as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("degrades to an empty array on a non-OK response, rather than throwing — a related-records fetch failure must never crash the whole detail page", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    expect(await getAssetRelatedRecords(ASSET_ID)).toEqual([]);
  });

  it("degrades to an empty array on a thrown network error", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as typeof fetch;
    expect(await getAssetRelatedRecords(ASSET_ID)).toEqual([]);
  });

  it("returns the related records on a 200", async () => {
    const record = {
      id: "r1",
      assetId: ASSET_ID,
      moduleKey: "projects",
      recordId: "22222222-2222-2222-2222-222222222222",
      note: "Used on the campaign landing page",
      createdBy: null,
      createdAt: "2026-08-28T00:00:00.000Z",
      updatedAt: "2026-08-28T00:00:00.000Z",
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [record], correlationId: "test" }),
    } as Response);

    expect(await getAssetRelatedRecords(ASSET_ID)).toEqual([record]);
  });
});
