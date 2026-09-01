import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import type { PortfolioAsset, PortfolioRecord } from "@webdesk/shared-types";
import {
  getAssetsForPortfolioPicker,
  getPortfolioDetail,
  getPortfolioRecord,
  getPortfolioRecords,
  getProofClaimsForPortfolioPicker,
} from "../../lib/portfolio-library.js";

function recordFixture(id: string, overrides: Partial<PortfolioRecord> = {}): PortfolioRecord {
  return {
    id,
    publicId: `PL-${id}`,
    projectOrClientName: "Acme Corp",
    url: null,
    primaryCategory: null,
    additionalCategories: [],
    tags: [],
    industry: null,
    platform: null,
    serviceType: null,
    launchDate: null,
    relatedProofIds: [],
    visibility: "public",
    approvalStatus: "draft",
    isPublished: false,
    publishedAt: null,
    version: 1,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

function screenshotFixture(id: string, overrides: Partial<PortfolioAsset> = {}): PortfolioAsset {
  return {
    id,
    portfolioRecordId: "record-1",
    assetId: `asset-${id}`,
    role: "hero",
    caption: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("getPortfolioRecords", () => {
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
      getPortfolioRecords({
        approvalStatus: null,
        isPublished: null,
        search: null,
        offset: 0,
        pageSize: 20,
      }),
    ).rejects.toThrow(/Failed to load portfolio records/);
  });

  it("requests one row past the chosen page size, to detect a real next page, including approvalStatus/isPublished", async () => {
    const requestedUrls: string[] = [];
    global.fetch = vi.fn((url: string) => {
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [], correlationId: "test" }),
      } as Response);
    }) as typeof fetch;

    await getPortfolioRecords({
      approvalStatus: "draft",
      isPublished: true,
      search: "acme",
      offset: 25,
      pageSize: 20,
    });

    expect(requestedUrls[0]).toBe(
      "https://api.example.com/portfolio-library/records?approvalStatus=draft&isPublished=true&search=acme&limit=21&offset=25",
    );
  });

  it("reports hasNextPage: true and trims the extra row when the backend returns one more than the page size", async () => {
    const items = Array.from({ length: 21 }, (_, i) => recordFixture(`r${i}`));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items, correlationId: "test" }),
    } as Response);

    const result = await getPortfolioRecords({
      approvalStatus: null,
      isPublished: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });

    expect(result.items).toHaveLength(20);
    expect(result.hasNextPage).toBe(true);
  });
});

describe("getPortfolioRecord", () => {
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
    const result = await getPortfolioRecord("not-a-uuid");
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns null on a 404", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getPortfolioRecord(VALID_ID)).toBeNull();
  });

  it("throws on a non-404 non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response);
    await expect(getPortfolioRecord(VALID_ID)).rejects.toThrow(/Failed to load portfolio record/);
  });

  it("returns the portfolio record on a 200", async () => {
    const record = recordFixture(VALID_ID, { url: "https://example.com" });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: record, correlationId: "test" }),
    } as Response);

    const result = await getPortfolioRecord(VALID_ID);
    expect(result?.id).toBe(VALID_ID);
    expect(result?.url).toBe("https://example.com");
  });
});

describe("getPortfolioDetail", () => {
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
    const result = await getPortfolioDetail("not-a-uuid");
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns null on a 404 from the primary fetch, discarding the concurrent screenshots fetch", async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/screenshots")) {
        return Promise.resolve({ ok: false, status: 500 } as Response);
      }
      return Promise.resolve({ ok: false, status: 404 } as Response);
    });

    const result = await getPortfolioDetail(VALID_ID);
    expect(result).toBeNull();
  });

  it("fetches the record and its screenshots concurrently and returns both", async () => {
    const record = recordFixture(VALID_ID);
    const screenshots = [screenshotFixture("shot-1")];
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/screenshots")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: screenshots, correlationId: "test" }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: record, correlationId: "test" }),
      } as Response);
    });

    const result = await getPortfolioDetail(VALID_ID);
    expect(result?.record.id).toBe(VALID_ID);
    expect(result?.screenshots).toEqual(screenshots);
  });
});

describe("getProofClaimsForPortfolioPicker / getAssetsForPortfolioPicker", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    vi.mocked(cookies).mockResolvedValue({ toString: () => "sid=abc" } as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("getProofClaimsForPortfolioPicker: degrades to [] on failure, logging the error", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(getProofClaimsForPortfolioPicker()).resolves.toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  });

  it("getProofClaimsForPortfolioPicker: returns the fetched claims on success", async () => {
    const items = [
      {
        id: "claim-1",
        publicId: "PC-1",
        claim: "<p>x</p>",
        claimType: null,
        beforeValue: null,
        afterValue: null,
        verificationStatus: "unverified",
        approvedWording: null,
        restrictions: null,
        expiryReviewDate: null,
        relatedServiceIds: [],
        relatedCaseStudyIds: [],
        relatedPageIds: [],
        approvalStatus: "draft",
        createdBy: null,
        updatedBy: null,
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z",
      },
    ];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items, correlationId: "test" }),
    } as Response);
    expect(await getProofClaimsForPortfolioPicker()).toEqual(items);
  });

  it("getAssetsForPortfolioPicker: degrades to [] on failure, logging the error", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(getAssetsForPortfolioPicker()).resolves.toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  });
});
