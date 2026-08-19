import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LogoutPage from "../../app/auth/logout/page.js";

describe("LogoutPage", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("calls both dashboard-api's /auth/logout AND this app's own /auth/session DELETE route, revoking both of a login's two sessions", async () => {
    const calledUrls: string[] = [];
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      calledUrls.push(`${init?.method ?? "GET"} ${url}`);
      return Promise.resolve({ ok: true } as Response);
    });
    global.fetch = fetchMock as typeof fetch;

    render(<LogoutPage />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(calledUrls).toContain("POST https://api.example.com/auth/logout");
    expect(calledUrls).toContain("DELETE /auth/session");
  });

  it("shows 'Signed out' once both calls settle, even if one of them fails", async () => {
    global.fetch = vi.fn((url: string) => {
      if (url.includes("/auth/session")) {
        return Promise.reject(new Error("network error"));
      }
      return Promise.resolve({ ok: true } as Response);
    }) as typeof fetch;

    render(<LogoutPage />);

    expect(screen.getByText("Signing out…")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Signed out")).toBeInTheDocument());
  });
});
