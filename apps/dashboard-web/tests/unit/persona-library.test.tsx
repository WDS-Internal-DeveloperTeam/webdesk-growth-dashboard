import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import type { Persona, Service } from "@webdesk/shared-types";
import {
  buildPersonaLibraryHref,
  getPersona,
  getPersonas,
  getServicesForPersonaPicker,
  parsePersonaLibrarySearchParams,
  personaApprovalStatusBadge,
} from "../../lib/persona-library.js";

describe("parsePersonaLibrarySearchParams", () => {
  it("defaults to no filters, offset 0, pageSize 20 when nothing is provided", () => {
    expect(parsePersonaLibrarySearchParams({})).toEqual({
      approvalStatus: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("parses valid approvalStatus/search/offset/pageSize values", () => {
    expect(
      parsePersonaLibrarySearchParams({
        approvalStatus: "under_review",
        search: "enterprise",
        offset: "25",
        pageSize: "50",
      }),
    ).toEqual({
      approvalStatus: "under_review",
      search: "enterprise",
      offset: 25,
      pageSize: 50,
    });
  });

  it("falls back to defaults for invalid/garbled enum values instead of passing them through", () => {
    expect(
      parsePersonaLibrarySearchParams({
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
    expect(parsePersonaLibrarySearchParams({ offset: "-10" }).offset).toBe(0);
  });

  it("clamps an overlong search term to 255 characters", () => {
    const overlong = "x".repeat(300);
    expect(parsePersonaLibrarySearchParams({ search: overlong }).search).toHaveLength(255);
  });

  it("takes the first value when a param is duplicated in the URL", () => {
    expect(
      parsePersonaLibrarySearchParams({ approvalStatus: ["draft", "approved"] }).approvalStatus,
    ).toBe("draft");
  });
});

describe("buildPersonaLibraryHref", () => {
  const baseQuery = {
    approvalStatus: null,
    search: null,
    offset: 0,
    pageSize: 20 as const,
  };

  it("returns the bare path when nothing is set", () => {
    expect(buildPersonaLibraryHref(baseQuery, {})).toBe("/persona-library");
  });

  it("includes approvalStatus/search and omits offset=0/the default pageSize", () => {
    expect(buildPersonaLibraryHref(baseQuery, { approvalStatus: "draft", search: "cto" })).toBe(
      "/persona-library?approvalStatus=draft&search=cto",
    );
  });

  it("resets offset to 0 when an override other than offset itself is applied", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildPersonaLibraryHref(withOffset, { approvalStatus: "approved" })).toBe(
      "/persona-library?approvalStatus=approved",
    );
  });

  it("keeps a nonzero offset when explicitly set", () => {
    expect(buildPersonaLibraryHref(baseQuery, { offset: 25 })).toBe("/persona-library?offset=25");
  });

  it("includes a non-default pageSize and resets offset to 0", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildPersonaLibraryHref(withOffset, { pageSize: 50 })).toBe(
      "/persona-library?pageSize=50",
    );
  });
});

describe("personaApprovalStatusBadge", () => {
  it("maps under_review and revision_requested to the same degraded token, disambiguated by label", () => {
    expect(personaApprovalStatusBadge("under_review")).toEqual({
      token: "degraded",
      label: "Under Review",
    });
    expect(personaApprovalStatusBadge("revision_requested")).toEqual({
      token: "degraded",
      label: "Revision Requested",
    });
  });

  it("maps approved to healthy and rejected to unavailable", () => {
    expect(personaApprovalStatusBadge("approved").token).toBe("healthy");
    expect(personaApprovalStatusBadge("rejected").token).toBe("unavailable");
  });
});

function personaFixture(id: string, overrides: Partial<Persona> = {}): Persona {
  return {
    id,
    publicId: `PERSONA-${id}`,
    name: "Enterprise IT Director",
    buyerType: null,
    companySize: null,
    roles: [],
    industries: [],
    geography: null,
    goals: null,
    pains: null,
    triggers: null,
    objections: null,
    decisionCriteria: null,
    relatedServiceIds: [],
    badFitSignals: null,
    messagingTrack: null,
    ctaPreferences: null,
    approvalStatus: "draft",
    version: 1,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-22T00:00:00.000Z",
    updatedAt: "2026-08-22T00:00:00.000Z",
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

describe("getPersonas", () => {
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
      getPersonas({ approvalStatus: null, search: null, offset: 0, pageSize: 20 }),
    ).rejects.toThrow(/Failed to load personas/);
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

    await getPersonas({ approvalStatus: "draft", search: "director", offset: 25, pageSize: 20 });

    expect(requestedUrls[0]).toBe(
      "https://api.example.com/persona-library/personas?approvalStatus=draft&search=director&limit=21&offset=25",
    );
  });

  it("reports hasNextPage: true and trims the extra row when the backend returns one more than the page size", async () => {
    const items = Array.from({ length: 21 }, (_, i) => personaFixture(`p${i}`));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items, correlationId: "test" }),
    } as Response);

    const result = await getPersonas({
      approvalStatus: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });

    expect(result.items).toHaveLength(20);
    expect(result.hasNextPage).toBe(true);
  });
});

describe("getPersona", () => {
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
    const result = await getPersona("not-a-uuid");
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns null on a 404", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getPersona(VALID_ID)).toBeNull();
  });

  it("throws on a non-404 non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response);
    await expect(getPersona(VALID_ID)).rejects.toThrow(/Failed to load persona/);
  });

  it("returns the persona on a 200", async () => {
    const persona = personaFixture(VALID_ID, { roles: ["CTO"], relatedServiceIds: ["svc-1"] });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: persona, correlationId: "test" }),
    } as Response);

    const result = await getPersona(VALID_ID);
    expect(result?.id).toBe(VALID_ID);
    expect(result?.roles).toEqual(["CTO"]);
    expect(result?.relatedServiceIds).toEqual(["svc-1"]);
  });
});

describe("getServicesForPersonaPicker", () => {
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

    await getServicesForPersonaPicker();

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

    expect(await getServicesForPersonaPicker()).toEqual(items);
  });
});
