import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import type { UserSummary } from "@webdesk/shared-types";
import { getUser } from "../../lib/users.js";

const VALID_ID = "66666666-6666-6666-6666-666666666666";

function userFixture(): UserSummary {
  return { id: VALID_ID, displayName: "Jane Doe", email: "jane@example.com" };
}

describe("getUser", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    vi.mocked(cookies).mockResolvedValue({ toString: () => "sid=abc" } as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns null for a malformed id without calling fetch", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    expect(await getUser("not-a-real-id")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null on a 404 (e.g. a disabled or removed owner)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 404, ok: false } as Response);
    global.fetch = fetchMock as typeof fetch;

    expect(await getUser(VALID_ID)).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.com/users/${VALID_ID}`,
      expect.objectContaining({ headers: { cookie: "sid=abc" } }),
    );
  });

  it("returns the resolved summary on success", async () => {
    const user = userFixture();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: user, correlationId: "corr-1" }),
    } as Response);
    global.fetch = fetchMock as typeof fetch;

    expect(await getUser(VALID_ID)).toEqual(user);
  });

  it("throws on a non-404 non-OK status", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    global.fetch = fetchMock as typeof fetch;

    await expect(getUser(VALID_ID)).rejects.toThrow("Failed to load user (status 500)");
  });
});
