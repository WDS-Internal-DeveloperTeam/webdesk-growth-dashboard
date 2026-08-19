import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import { DELETE } from "../../app/auth/session/route.js";

const API_BASE_URL = "https://api.example.com";

function mockCookieJar(header: string): { deleteFn: ReturnType<typeof vi.fn> } {
  const deleteFn = vi.fn();
  vi.mocked(cookies).mockResolvedValue({
    toString: () => header,
    delete: deleteFn,
  } as never);
  return { deleteFn };
}

describe("DELETE /auth/session", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = API_BASE_URL;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    vi.restoreAllMocks();
  });

  it("forwards the whole incoming Cookie header (not a name-keyed lookup) to POST /auth/logout, with an explicit Origin header", async () => {
    const { deleteFn } = mockCookieJar("wds_session=raw-token; other=value");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as typeof fetch;

    await DELETE(new Request("https://dashboard.example.com/auth/session"));

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/auth/logout`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          cookie: "wds_session=raw-token; other=value",
          origin: "https://dashboard.example.com",
        }),
      }),
    );
    expect(deleteFn).toHaveBeenCalledWith("wds_session");
  });

  it("skips the dashboard-api call when there is no cookie header at all, but still clears the local cookie", async () => {
    const { deleteFn } = mockCookieJar("");
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    const response = await DELETE(new Request("https://dashboard.example.com/auth/session"));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(deleteFn).toHaveBeenCalledWith("wds_session");
    expect(response.status).toBe(200);
  });

  it("still clears the local cookie and returns success even when the dashboard-api revoke call fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { deleteFn } = mockCookieJar("wds_session=raw-token");
    global.fetch = vi.fn().mockRejectedValue(new Error("network error")) as typeof fetch;

    const response = await DELETE(new Request("https://dashboard.example.com/auth/session"));

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(deleteFn).toHaveBeenCalledWith("wds_session");
    expect(response.status).toBe(200);
    const body = (await response.json()) as { success: boolean };
    expect(body.success).toBe(true);
  });

  it("still clears the local cookie when NEXT_PUBLIC_API_BASE_URL is not configured", async () => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { deleteFn } = mockCookieJar("wds_session=raw-token");
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    const response = await DELETE(new Request("https://dashboard.example.com/auth/session"));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(deleteFn).toHaveBeenCalledWith("wds_session");
    expect(response.status).toBe(200);
  });
});
