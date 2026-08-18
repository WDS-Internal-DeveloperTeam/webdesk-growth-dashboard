import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import { GET } from "../../app/auth/exchange/route.js";
import { SESSION_COOKIE_NAME } from "../../lib/session-cookie.js";

const API_BASE_URL = "https://api.example.com";

function mockCookieSet(): ReturnType<typeof vi.fn> {
  const set = vi.fn();
  vi.mocked(cookies).mockResolvedValue({ set } as never);
  return set;
}

describe("GET /auth/exchange", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = API_BASE_URL;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    vi.restoreAllMocks();
  });

  it("redirects to /auth/error?reason=expired when no code is present, without calling fetch", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    const response = await GET(new Request("https://dashboard.example.com/auth/exchange"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://dashboard.example.com/auth/error?reason=expired",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("redirects to /auth/error?reason=expired when NEXT_PUBLIC_API_BASE_URL is not configured", async () => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    const response = await GET(new Request("https://dashboard.example.com/auth/exchange?code=abc"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://dashboard.example.com/auth/error?reason=expired",
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("redirects to /auth/error?reason=expired when POST /auth/exchange rejects with a network error", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = vi.fn().mockRejectedValue(new Error("network error")) as typeof fetch;

    const response = await GET(new Request("https://dashboard.example.com/auth/exchange?code=abc"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://dashboard.example.com/auth/error?reason=expired",
    );
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("redirects to /auth/error?reason=expired when the code is invalid or expired (400)", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 400 } as Response) as typeof fetch;

    const response = await GET(
      new Request("https://dashboard.example.com/auth/exchange?code=bad-code"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://dashboard.example.com/auth/error?reason=expired",
    );
  });

  it("logs an unexpected non-400 failure status but still redirects to the generic error page", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 500 } as Response) as typeof fetch;

    const response = await GET(new Request("https://dashboard.example.com/auth/exchange?code=abc"));

    expect(response.status).toBe(307);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("500"));
  });

  it("on success, sets the session cookie and redirects to /home", async () => {
    const setCookie = mockCookieSet();
    const expiresAt = new Date(Date.now() + 3600_000).toISOString();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: { sessionToken: "new-raw-token", expiresAt },
        correlationId: "corr-1",
      }),
    } as Response);
    global.fetch = fetchMock as typeof fetch;

    const response = await GET(
      new Request("https://dashboard.example.com/auth/exchange?code=good-code"),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/auth/exchange`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ code: "good-code" }),
      }),
    );
    expect(setCookie).toHaveBeenCalledWith(
      SESSION_COOKIE_NAME,
      "new-raw-token",
      expect.objectContaining({ httpOnly: true, secure: true, sameSite: "lax", path: "/" }),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://dashboard.example.com/home");
  });
});
