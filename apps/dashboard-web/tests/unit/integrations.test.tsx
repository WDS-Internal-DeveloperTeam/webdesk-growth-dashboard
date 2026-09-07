import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import type { Integration } from "@webdesk/shared-types";
import { getIntegration, getIntegrations } from "../../lib/integrations.js";

function integrationFixture(id: string, overrides: Partial<Integration> = {}): Integration {
  return {
    id,
    publicId: `INTEG-${id}`,
    provider: "github",
    displayName: "Primary GitHub App",
    status: "connected",
    configReference: null,
    notes: null,
    lastVerifiedAt: null,
    lastVerifiedByUserId: null,
    lastVerificationResult: null,
    lastVerificationNotes: null,
    isActive: true,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("getIntegrations", () => {
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
      getIntegrations({
        provider: null,
        status: null,
        isActive: null,
        search: null,
        offset: 0,
        pageSize: 20,
      }),
    ).rejects.toThrow(/Failed to load integrations/);
  });

  it("requests one row past the chosen page size, to detect a real next page, including provider/status/isActive", async () => {
    const requestedUrls: string[] = [];
    global.fetch = vi.fn((url: string) => {
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [], correlationId: "test" }),
      } as Response);
    }) as typeof fetch;

    await getIntegrations({
      provider: "github",
      status: "connected",
      isActive: true,
      search: "prod",
      offset: 25,
      pageSize: 20,
    });

    expect(requestedUrls[0]).toBe(
      "https://api.example.com/integrations?provider=github&status=connected&isActive=true&search=prod&limit=21&offset=25",
    );
  });

  it("reports hasNextPage: true and trims the extra row when the backend returns one more than the page size", async () => {
    const items = Array.from({ length: 21 }, (_, i) => integrationFixture(`i${i}`));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items, correlationId: "test" }),
    } as Response);

    const result = await getIntegrations({
      provider: null,
      status: null,
      isActive: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });

    expect(result.items).toHaveLength(20);
    expect(result.hasNextPage).toBe(true);
  });
});

describe("getIntegration", () => {
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
    const result = await getIntegration("not-a-uuid");
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns null on a 404", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getIntegration(VALID_ID)).toBeNull();
  });

  it("throws on a non-404 non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response);
    await expect(getIntegration(VALID_ID)).rejects.toThrow(/Failed to load integration/);
  });

  it("returns the integration on a 200", async () => {
    const integration = integrationFixture(VALID_ID, { displayName: "Prod GitHub App" });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: integration, correlationId: "test" }),
    } as Response);

    const result = await getIntegration(VALID_ID);
    expect(result?.id).toBe(VALID_ID);
    expect(result?.displayName).toBe("Prod GitHub App");
  });
});
