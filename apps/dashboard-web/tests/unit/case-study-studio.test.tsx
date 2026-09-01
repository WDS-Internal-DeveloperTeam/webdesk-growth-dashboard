import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import type {
  Asset,
  CaseStudy,
  CaseStudyApproval,
  CaseStudyAsset,
  CaseStudyConsent,
  ProofClaim,
  Service,
} from "@webdesk/shared-types";
import {
  buildCaseStudyStudioHref,
  caseStudyStatusBadge,
  getAssetsForCaseStudyPicker,
  getCaseStudies,
  getCaseStudy,
  getCaseStudyDetail,
  getProofClaimsForCaseStudyPicker,
  getServicesForCaseStudyPicker,
  parseCaseStudyStudioSearchParams,
} from "../../lib/case-study-studio.js";

describe("parseCaseStudyStudioSearchParams", () => {
  it("defaults to no filters, offset 0, pageSize 20 when nothing is provided", () => {
    expect(parseCaseStudyStudioSearchParams({})).toEqual({
      status: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("parses valid status/search/offset/pageSize values", () => {
    expect(
      parseCaseStudyStudioSearchParams({
        status: "internal_approval",
        search: "acme",
        offset: "25",
        pageSize: "50",
      }),
    ).toEqual({
      status: "internal_approval",
      search: "acme",
      offset: 25,
      pageSize: 50,
    });
  });

  it("falls back to defaults for invalid/garbled enum values instead of passing them through", () => {
    expect(
      parseCaseStudyStudioSearchParams({
        status: "not_a_real_status",
        offset: "not-a-number",
        pageSize: "37",
      }),
    ).toEqual({
      status: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("clamps a negative offset to 0", () => {
    expect(parseCaseStudyStudioSearchParams({ offset: "-10" }).offset).toBe(0);
  });

  it("clamps an overlong search term to 255 characters", () => {
    const overlong = "x".repeat(300);
    expect(parseCaseStudyStudioSearchParams({ search: overlong }).search).toHaveLength(255);
  });

  it("takes the first value when a param is duplicated in the URL", () => {
    expect(parseCaseStudyStudioSearchParams({ status: ["draft", "published"] }).status).toBe(
      "draft",
    );
  });
});

describe("buildCaseStudyStudioHref", () => {
  const baseQuery = { status: null, search: null, offset: 0, pageSize: 20 as const };

  it("returns the bare path when nothing is set", () => {
    expect(buildCaseStudyStudioHref(baseQuery, {})).toBe("/case-study-studio");
  });

  it("includes status/search and omits offset=0/the default pageSize", () => {
    expect(buildCaseStudyStudioHref(baseQuery, { status: "draft", search: "acme" })).toBe(
      "/case-study-studio?status=draft&search=acme",
    );
  });

  it("resets offset to 0 when an override other than offset itself is applied", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildCaseStudyStudioHref(withOffset, { status: "published" })).toBe(
      "/case-study-studio?status=published",
    );
  });

  it("keeps a nonzero offset when explicitly set", () => {
    expect(buildCaseStudyStudioHref(baseQuery, { offset: 25 })).toBe(
      "/case-study-studio?offset=25",
    );
  });
});

describe("caseStudyStatusBadge", () => {
  it("maps published and scheduled to the same healthy token", () => {
    expect(caseStudyStatusBadge("published").token).toBe("healthy");
    expect(caseStudyStatusBadge("scheduled").token).toBe("healthy");
  });

  it("maps unpublished to a distinct token from archived (not terminal)", () => {
    expect(caseStudyStatusBadge("unpublished").token).not.toBe(
      caseStudyStatusBadge("archived").token,
    );
    expect(caseStudyStatusBadge("archived").token).toBe("unavailable");
  });

  it("maps every review/approval stage to the degraded token", () => {
    expect(caseStudyStatusBadge("internal_approval").token).toBe("degraded");
    expect(caseStudyStatusBadge("client_approval").token).toBe("degraded");
    expect(caseStudyStatusBadge("fact_confidentiality_review").token).toBe("degraded");
  });
});

function caseStudyFixture(id: string, overrides: Partial<CaseStudy> = {}): CaseStudy {
  return {
    id,
    publicId: `CS-${id}`,
    clientName: "Acme Corp",
    projectTitle: "Headless migration",
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
    status: "intake",
    scheduledPublishAt: null,
    publishedAt: null,
    unpublishReason: null,
    version: 1,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-27T00:00:00.000Z",
    updatedAt: "2026-08-27T00:00:00.000Z",
    ...overrides,
  };
}

function assetLinkFixture(id: string, overrides: Partial<CaseStudyAsset> = {}): CaseStudyAsset {
  return {
    id,
    caseStudyId: "cs-1",
    assetId: "asset-1",
    role: "hero_screenshot",
    caption: null,
    createdAt: "2026-08-27T00:00:00.000Z",
    updatedAt: "2026-08-27T00:00:00.000Z",
    ...overrides,
  };
}

function consentFixture(id: string, overrides: Partial<CaseStudyConsent> = {}): CaseStudyConsent {
  return {
    id,
    caseStudyId: "cs-1",
    consentType: "client_publication",
    consentEvidenceReference: null,
    grantedBy: null,
    grantedAt: null,
    notes: null,
    createdAt: "2026-08-27T00:00:00.000Z",
    updatedAt: "2026-08-27T00:00:00.000Z",
    ...overrides,
  };
}

function approvalFixture(
  id: string,
  overrides: Partial<CaseStudyApproval> = {},
): CaseStudyApproval {
  return {
    id,
    caseStudyId: "cs-1",
    approvalType: "internal",
    decision: "approved",
    decidedByUserId: null,
    decidedAt: "2026-08-27T00:00:00.000Z",
    notes: null,
    createdAt: "2026-08-27T00:00:00.000Z",
    updatedAt: "2026-08-27T00:00:00.000Z",
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

function assetFixture(id: string, overrides: Partial<Asset> = {}): Asset {
  return {
    id,
    publicId: `ASSET-${id}`,
    title: "Hero screenshot",
    description: null,
    mimeType: null,
    fileSizeBytes: null,
    checksum: null,
    widthPx: null,
    heightPx: null,
    durationSeconds: null,
    licence: null,
    licenceHolder: null,
    altTextGuidance: null,
    visibility: "public",
    retentionNote: null,
    scanStatus: "not_configured",
    approvalStatus: "draft",
    version: 1,
    isPublished: false,
    publishedAt: null,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-27T00:00:00.000Z",
    updatedAt: "2026-08-27T00:00:00.000Z",
    ...overrides,
  } as Asset;
}

describe("getCaseStudies", () => {
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
      getCaseStudies({ status: null, search: null, offset: 0, pageSize: 20 }),
    ).rejects.toThrow(/Failed to load case studies/);
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

    await getCaseStudies({ status: "draft", search: "acme", offset: 25, pageSize: 20 });

    expect(requestedUrls[0]).toBe(
      "https://api.example.com/case-study-studio/case-studies?status=draft&search=acme&limit=21&offset=25",
    );
  });

  it("reports hasNextPage: true and trims the extra row when the backend returns one more than the page size", async () => {
    const items = Array.from({ length: 21 }, (_, i) => caseStudyFixture(`c${i}`));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items, correlationId: "test" }),
    } as Response);

    const result = await getCaseStudies({ status: null, search: null, offset: 0, pageSize: 20 });

    expect(result.items).toHaveLength(20);
    expect(result.hasNextPage).toBe(true);
  });
});

describe("getCaseStudy", () => {
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
    const result = await getCaseStudy("not-a-uuid");
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns null on a 404", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getCaseStudy(VALID_ID)).toBeNull();
  });

  it("throws on a non-404 non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response);
    await expect(getCaseStudy(VALID_ID)).rejects.toThrow(/Failed to load case study/);
  });

  it("returns the case study on a 200", async () => {
    const caseStudy = caseStudyFixture(VALID_ID, { relatedServiceIds: ["svc-1"] });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: caseStudy, correlationId: "test" }),
    } as Response);

    const result = await getCaseStudy(VALID_ID);
    expect(result?.id).toBe(VALID_ID);
    expect(result?.relatedServiceIds).toEqual(["svc-1"]);
  });
});

describe("getCaseStudyDetail", () => {
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
    const result = await getCaseStudyDetail("not-a-uuid");
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns null on a 404 from the primary fetch, discarding the concurrent sub-resource fetches", async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/assets") || url.endsWith("/consents") || url.endsWith("/approvals")) {
        return Promise.resolve({ ok: false, status: 500 } as Response);
      }
      return Promise.resolve({ ok: false, status: 404 } as Response);
    });

    const result = await getCaseStudyDetail(VALID_ID);
    expect(result).toBeNull();
  });

  it("fetches the case study and its 3 sub-resources concurrently and returns all of them", async () => {
    const caseStudy = caseStudyFixture(VALID_ID);
    const assets = [assetLinkFixture("link-1")];
    const consents = [consentFixture("consent-1")];
    const approvals = [approvalFixture("approval-1")];
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/assets")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: assets, correlationId: "test" }),
        } as Response);
      }
      if (url.endsWith("/consents")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: consents, correlationId: "test" }),
        } as Response);
      }
      if (url.endsWith("/approvals")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: approvals, correlationId: "test" }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: caseStudy, correlationId: "test" }),
      } as Response);
    });

    const result = await getCaseStudyDetail(VALID_ID);
    expect(result?.caseStudy.id).toBe(VALID_ID);
    expect(result?.assets).toEqual(assets);
    expect(result?.consents).toEqual(consents);
    expect(result?.approvals).toEqual(approvals);
  });
});

describe("getServicesForCaseStudyPicker / getProofClaimsForCaseStudyPicker / getAssetsForCaseStudyPicker", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    vi.mocked(cookies).mockResolvedValue({ toString: () => "sid=abc" } as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("getServicesForCaseStudyPicker: requests services at page size 100 and degrades to [] on failure", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(getServicesForCaseStudyPicker()).resolves.toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  });

  it("getServicesForCaseStudyPicker: returns the fetched services on success", async () => {
    const items = [serviceFixture("s1")];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items, correlationId: "test" }),
    } as Response);
    expect(await getServicesForCaseStudyPicker()).toEqual(items);
  });

  it("getProofClaimsForCaseStudyPicker: degrades to [] on failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(getProofClaimsForCaseStudyPicker()).resolves.toEqual([]);
  });

  it("getProofClaimsForCaseStudyPicker: returns the fetched claims on success", async () => {
    const items = [claimFixture("c1")];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items, correlationId: "test" }),
    } as Response);
    expect(await getProofClaimsForCaseStudyPicker()).toEqual(items);
  });

  it("getAssetsForCaseStudyPicker: degrades to [] on failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = vi.fn().mockRejectedValue(new Error("network error"));
    await expect(getAssetsForCaseStudyPicker()).resolves.toEqual([]);
  });

  it("getAssetsForCaseStudyPicker: returns the fetched assets on success", async () => {
    const items = [assetFixture("a1")];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items, correlationId: "test" }),
    } as Response);
    expect(await getAssetsForCaseStudyPicker()).toEqual(items);
  });
});
