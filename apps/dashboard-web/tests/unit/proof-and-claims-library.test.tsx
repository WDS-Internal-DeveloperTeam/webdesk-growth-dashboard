import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import type { ClaimSource, ProofClaim, Service } from "@webdesk/shared-types";
import {
  buildProofAndClaimsLibraryHref,
  getProofClaim,
  getProofClaimDetail,
  getProofClaims,
  getServicesForClaimPicker,
  parseProofAndClaimsLibrarySearchParams,
  proofClaimApprovalStatusBadge,
} from "../../lib/proof-and-claims-library.js";

describe("parseProofAndClaimsLibrarySearchParams", () => {
  it("defaults to no filters, offset 0, pageSize 20 when nothing is provided", () => {
    expect(parseProofAndClaimsLibrarySearchParams({})).toEqual({
      approvalStatus: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("parses valid approvalStatus/search/offset/pageSize values", () => {
    expect(
      parseProofAndClaimsLibrarySearchParams({
        approvalStatus: "under_review",
        search: "uptime",
        offset: "25",
        pageSize: "50",
      }),
    ).toEqual({
      approvalStatus: "under_review",
      search: "uptime",
      offset: 25,
      pageSize: 50,
    });
  });

  it("falls back to defaults for invalid/garbled enum values instead of passing them through", () => {
    expect(
      parseProofAndClaimsLibrarySearchParams({
        approvalStatus: "not_a_real_status",
        offset: "not-a-number",
        pageSize: "37",
      }),
    ).toEqual({
      approvalStatus: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("clamps a negative offset to 0", () => {
    expect(parseProofAndClaimsLibrarySearchParams({ offset: "-10" }).offset).toBe(0);
  });

  it("clamps an overlong search term to 255 characters", () => {
    const overlong = "x".repeat(300);
    expect(parseProofAndClaimsLibrarySearchParams({ search: overlong }).search).toHaveLength(255);
  });

  it("takes the first value when a param is duplicated in the URL", () => {
    expect(
      parseProofAndClaimsLibrarySearchParams({ approvalStatus: ["draft", "approved"] })
        .approvalStatus,
    ).toBe("draft");
  });
});

describe("buildProofAndClaimsLibraryHref", () => {
  const baseQuery = {
    approvalStatus: null,
    search: null,
    offset: 0,
    pageSize: 20 as const,
  };

  it("returns the bare path when nothing is set", () => {
    expect(buildProofAndClaimsLibraryHref(baseQuery, {})).toBe("/proof-and-claims-library");
  });

  it("includes approvalStatus/search and omits offset=0/the default pageSize", () => {
    expect(
      buildProofAndClaimsLibraryHref(baseQuery, { approvalStatus: "draft", search: "sla" }),
    ).toBe("/proof-and-claims-library?approvalStatus=draft&search=sla");
  });

  it("resets offset to 0 when an override other than offset itself is applied", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildProofAndClaimsLibraryHref(withOffset, { approvalStatus: "approved" })).toBe(
      "/proof-and-claims-library?approvalStatus=approved",
    );
  });

  it("keeps a nonzero offset when explicitly set", () => {
    expect(buildProofAndClaimsLibraryHref(baseQuery, { offset: 25 })).toBe(
      "/proof-and-claims-library?offset=25",
    );
  });

  it("includes a non-default pageSize and resets offset to 0", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildProofAndClaimsLibraryHref(withOffset, { pageSize: 50 })).toBe(
      "/proof-and-claims-library?pageSize=50",
    );
  });
});

describe("proofClaimApprovalStatusBadge", () => {
  it("maps under_review and revision_requested to the same degraded token, disambiguated by label", () => {
    expect(proofClaimApprovalStatusBadge("under_review")).toEqual({
      token: "degraded",
      label: "Under Review",
    });
    expect(proofClaimApprovalStatusBadge("revision_requested")).toEqual({
      token: "degraded",
      label: "Revision Requested",
    });
  });

  it("maps approved to healthy and rejected to unavailable", () => {
    expect(proofClaimApprovalStatusBadge("approved").token).toBe("healthy");
    expect(proofClaimApprovalStatusBadge("rejected").token).toBe("unavailable");
  });
});

function claimFixture(id: string, overrides: Partial<ProofClaim> = {}): ProofClaim {
  return {
    id,
    publicId: `PROOF-${id}`,
    claim: "<p>99.9% uptime SLA</p>",
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
    createdAt: "2026-08-23T00:00:00.000Z",
    updatedAt: "2026-08-23T00:00:00.000Z",
    ...overrides,
  };
}

function sourceFixture(id: string, overrides: Partial<ClaimSource> = {}): ClaimSource {
  return {
    id,
    claimId: "claim-1",
    source: "Q3 uptime report",
    sourceUrl: null,
    createdAt: "2026-08-23T00:00:00.000Z",
    updatedAt: "2026-08-23T00:00:00.000Z",
    ...overrides,
  };
}

function serviceFixture(id: string, overrides: Partial<Service> = {}): Service {
  return {
    id,
    publicId: `SVC-${id}`,
    canonicalName: "Headless Commerce",
    publicName: null,
    categoryId: "cat-1",
    parentServiceId: null,
    shortPublicDescription: null,
    audience: null,
    problems: null,
    capabilities: null,
    outcomes: null,
    exclusions: null,
    internalDescription: null,
    icpIds: [],
    relatedPageIds: [],
    relatedCaseStudyIds: [],
    confidentiality: "internal",
    publicationStatus: "draft",
    approvalStatus: "draft",
    ownerUserId: null,
    createdAt: "2026-08-21T00:00:00.000Z",
    updatedAt: "2026-08-21T00:00:00.000Z",
    ...overrides,
  };
}

describe("getProofClaims", () => {
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
      getProofClaims({ approvalStatus: null, search: null, offset: 0, pageSize: 20 }),
    ).rejects.toThrow(/Failed to load proof claims/);
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

    await getProofClaims({ approvalStatus: "draft", search: "uptime", offset: 25, pageSize: 20 });

    expect(requestedUrls[0]).toBe(
      "https://api.example.com/proof-and-claims-library/claims?approvalStatus=draft&search=uptime&limit=21&offset=25",
    );
  });

  it("reports hasNextPage: true and trims the extra row when the backend returns one more than the page size", async () => {
    const items = Array.from({ length: 21 }, (_, i) => claimFixture(`c${i}`));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items, correlationId: "test" }),
    } as Response);

    const result = await getProofClaims({
      approvalStatus: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });

    expect(result.items).toHaveLength(20);
    expect(result.hasNextPage).toBe(true);
  });
});

describe("getProofClaim", () => {
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
    const result = await getProofClaim("not-a-uuid");
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns null on a 404", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getProofClaim(VALID_ID)).toBeNull();
  });

  it("throws on a non-404 non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response);
    await expect(getProofClaim(VALID_ID)).rejects.toThrow(/Failed to load proof claim/);
  });

  it("returns the proof claim on a 200", async () => {
    const claim = claimFixture(VALID_ID, { relatedServiceIds: ["svc-1"] });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: claim, correlationId: "test" }),
    } as Response);

    const result = await getProofClaim(VALID_ID);
    expect(result?.id).toBe(VALID_ID);
    expect(result?.relatedServiceIds).toEqual(["svc-1"]);
  });
});

describe("getProofClaimDetail", () => {
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
    const result = await getProofClaimDetail("not-a-uuid");
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns null on a 404 from the primary claim fetch, discarding the concurrent sources fetch", async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/sources")) {
        return Promise.resolve({ ok: false, status: 500 } as Response);
      }
      return Promise.resolve({ ok: false, status: 404 } as Response);
    });

    const result = await getProofClaimDetail(VALID_ID);
    expect(result).toBeNull();
  });

  it("fetches the claim and its sources concurrently and returns both", async () => {
    const claim = claimFixture(VALID_ID);
    const sources = [sourceFixture("src-1"), sourceFixture("src-2")];
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/sources")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: sources, correlationId: "test" }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: claim, correlationId: "test" }),
      } as Response);
    });

    const result = await getProofClaimDetail(VALID_ID);
    expect(result?.claim.id).toBe(VALID_ID);
    expect(result?.sources).toEqual(sources);
  });

  it("throws when the sources fetch fails but the primary claim exists", async () => {
    const claim = claimFixture(VALID_ID);
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/sources")) {
        return Promise.resolve({ ok: false, status: 500 } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: claim, correlationId: "test" }),
      } as Response);
    });

    await expect(getProofClaimDetail(VALID_ID)).rejects.toThrow(/Failed to load claim sources/);
  });
});

describe("getServicesForClaimPicker", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    vi.mocked(cookies).mockResolvedValue({ toString: () => "sid=abc" } as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("requests services at the largest real page size (100), with no filters applied", async () => {
    const requestedUrls: string[] = [];
    global.fetch = vi.fn((url: string) => {
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [], correlationId: "test" }),
      } as Response);
    }) as typeof fetch;

    await getServicesForClaimPicker();

    expect(requestedUrls[0]).toBe(
      "https://api.example.com/service-library/services?limit=101&offset=0",
    );
  });

  it("returns the fetched services, trimmed to the page size", async () => {
    const items = [serviceFixture("s1"), serviceFixture("s2")];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items, correlationId: "test" }),
    } as Response);

    expect(await getServicesForClaimPicker()).toEqual(items);
  });

  it("degrades to an empty list instead of throwing when the fetch fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);

    await expect(getServicesForClaimPicker()).resolves.toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  });

  it("degrades to an empty list instead of throwing on a network error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = vi.fn().mockRejectedValue(new Error("network error"));

    await expect(getServicesForClaimPicker()).resolves.toEqual([]);
  });
});
