import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import { GET } from "../../app/auth/exchange/route.js";

const API_BASE_URL = "https://api.example.com";

function mockCookieSet(): ReturnType<typeof vi.fn> {
  const set = vi.fn();
  vi.mocked(cookies).mockResolvedValue({ set } as never);
  return set;
}

function successResponse(
  overrides: Partial<{ sessionToken: string; expiresAt: string; cookieName: string }> = {},
): Response {
  const expiresAt = overrides.expiresAt ?? new Date(Date.now() + 3600_000).toISOString();
  return {
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      data: {
        sessionToken: overrides.sessionToken ?? "new-raw-token",
        expiresAt,
        cookieName: overrides.cookieName ?? "wds_session",
      },
      correlationId: "corr-1",
    }),
  } as Response;
}

describe("GET /auth/exchange", () => {
  const originalFetch = global.fetch;
  const originalSecureEnv = process.env.SESSION_COOKIE_SECURE;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = API_BASE_URL;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    if (originalSecureEnv === undefined) {
      delete process.env.SESSION_COOKIE_SECURE;
    } else {
      process.env.SESSION_COOKIE_SECURE = originalSecureEnv;
    }
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

  it("redirects to /auth/error?reason=expired when dashboard-api returns a 200 with a malformed body", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected end of JSON input");
      },
    } as unknown as Response) as typeof fetch;

    const response = await GET(new Request("https://dashboard.example.com/auth/exchange?code=abc"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://dashboard.example.com/auth/error?reason=expired",
    );
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("on success, sets the cookie under the server-provided cookieName (not a locally-hardcoded one) and redirects to /home", async () => {
    const setCookie = mockCookieSet();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(successResponse({ cookieName: "a_different_cookie_name" }));
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
      "a_different_cookie_name",
      "new-raw-token",
      expect.objectContaining({ httpOnly: true, secure: true, sameSite: "lax", path: "/" }),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://dashboard.example.com/home");
  });

  it("sets secure: false when SESSION_COOKIE_SECURE=false (local non-HTTPS dev)", async () => {
    process.env.SESSION_COOKIE_SECURE = "false";
    const setCookie = mockCookieSet();
    global.fetch = vi.fn().mockResolvedValue(successResponse()) as typeof fetch;

    await GET(new Request("https://dashboard.example.com/auth/exchange?code=good-code"));

    expect(setCookie).toHaveBeenCalledWith(
      "wds_session",
      "new-raw-token",
      expect.objectContaining({ secure: false }),
    );
  });

  it("defaults secure: true when SESSION_COOKIE_SECURE is unset", async () => {
    delete process.env.SESSION_COOKIE_SECURE;
    const setCookie = mockCookieSet();
    global.fetch = vi.fn().mockResolvedValue(successResponse()) as typeof fetch;

    await GET(new Request("https://dashboard.example.com/auth/exchange?code=good-code"));

    expect(setCookie).toHaveBeenCalledWith(
      "wds_session",
      "new-raw-token",
      expect.objectContaining({ secure: true }),
    );
  });
});
