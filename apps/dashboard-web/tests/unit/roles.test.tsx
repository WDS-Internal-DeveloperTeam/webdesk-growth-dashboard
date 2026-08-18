import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import { getApproverRoleId } from "../../lib/roles.js";

describe("getApproverRoleId", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    vi.mocked(cookies).mockResolvedValue({ toString: () => "sid=abc" } as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns the id of the role keyed owner_growth_approver", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          { id: "role-1", key: "super_admin", name: "Super Admin" },
          { id: "role-2", key: "owner_growth_approver", name: "Owner / Growth Approver" },
        ],
        correlationId: "corr-1",
      }),
    } as Response);
    global.fetch = fetchMock as typeof fetch;

    expect(await getApproverRoleId()).toBe("role-2");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/authz/roles",
      expect.objectContaining({ headers: { cookie: "sid=abc" } }),
    );
  });

  it("returns null when the role isn't present in the response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: [{ id: "role-1", key: "super_admin", name: "Super Admin" }],
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    expect(await getApproverRoleId()).toBeNull();
  });

  it("returns null (not a thrown error) on a 403 — most roles lack users_roles:view", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 403 } as Response) as typeof fetch;

    expect(await getApproverRoleId()).toBeNull();
  });

  it("returns null (not a thrown error) on a network failure", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as typeof fetch;

    expect(await getApproverRoleId()).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
