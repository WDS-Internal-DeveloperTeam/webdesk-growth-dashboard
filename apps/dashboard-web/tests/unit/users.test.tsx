import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import type { UserSummary } from "@webdesk/shared-types";
import { getUser, getUsersByIds } from "../../lib/users.js";

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

describe("getUsersByIds", () => {
  const originalFetch = global.fetch;
  const idA = "77777777-7777-7777-7777-777777777777";
  const idB = "88888888-8888-8888-8888-888888888888";

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    vi.mocked(cookies).mockResolvedValue({ toString: () => "sid=abc" } as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns an empty map for an empty input, without calling fetch", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    const result = await getUsersByIds([]);

    expect(result.size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resolves each unique id in parallel, keyed by id", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith(`/users/${idA}`)) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { id: idA, displayName: "Alice", email: "alice@example.com" },
            correlationId: "corr-1",
          }),
        } as Response);
      }
      if (url.endsWith(`/users/${idB}`)) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { id: idB, displayName: "Bob", email: "bob@example.com" },
            correlationId: "corr-1",
          }),
        } as Response);
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    global.fetch = fetchMock as typeof fetch;

    const result = await getUsersByIds([idA, idB]);

    expect(result.get(idA)).toEqual({ id: idA, displayName: "Alice", email: "alice@example.com" });
    expect(result.get(idB)).toEqual({ id: idB, displayName: "Bob", email: "bob@example.com" });
  });

  it("deduplicates repeated ids into a single fetch each", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: { id: idA, displayName: "Alice", email: "alice@example.com" },
        correlationId: "corr-1",
      }),
    } as Response);
    global.fetch = fetchMock as typeof fetch;

    await getUsersByIds([idA, idA, idA]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("omits an id that fails to resolve (404) from the returned map, instead of throwing", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith(`/users/${idA}`)) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { id: idA, displayName: "Alice", email: "alice@example.com" },
            correlationId: "corr-1",
          }),
        } as Response);
      }
      return Promise.resolve({ ok: false, status: 404 } as Response);
    });
    global.fetch = fetchMock as typeof fetch;

    const result = await getUsersByIds([idA, idB]);

    expect(result.get(idA)).toEqual({ id: idA, displayName: "Alice", email: "alice@example.com" });
    expect(result.has(idB)).toBe(false);
    expect(result.size).toBe(1);
  });

  it("does not throw when one id 403s — omits it and logs, resolving the rest normally", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith(`/users/${idA}`)) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { id: idA, displayName: "Alice", email: "alice@example.com" },
            correlationId: "corr-1",
          }),
        } as Response);
      }
      // getUser() throws on any non-404 non-OK status (e.g. a 403 from a caller lacking
      // users_roles:view) — getUsersByIds() must not let that take down the whole batch.
      return Promise.resolve({ ok: false, status: 403 } as Response);
    });
    global.fetch = fetchMock as typeof fetch;

    const result = await getUsersByIds([idA, idB]);

    expect(result.get(idA)).toEqual({ id: idA, displayName: "Alice", email: "alice@example.com" });
    expect(result.has(idB)).toBe(false);
    expect(result.size).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(`failed to resolve user ${idB}`),
      expect.anything(),
    );
  });
});
