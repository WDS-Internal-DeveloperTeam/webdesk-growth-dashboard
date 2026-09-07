import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import type { AdminUser, AdminUserDetail, PermissionMatrix } from "@webdesk/shared-types";
import {
  adminUserStatusBadge,
  buildUsersRolesPermissionsHref,
  getAdminUserDetail,
  getAdminUsers,
  getPermissionMatrix,
  parseUsersRolesPermissionsSearchParams,
} from "../../lib/users-roles-permissions.js";

describe("parseUsersRolesPermissionsSearchParams", () => {
  it("defaults to no filters, offset 0, pageSize 20 when nothing is provided", () => {
    expect(parseUsersRolesPermissionsSearchParams({})).toEqual({
      status: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("parses a real status/search/offset/pageSize combination", () => {
    expect(
      parseUsersRolesPermissionsSearchParams({
        status: "disabled",
        search: "jane",
        offset: "40",
        pageSize: "50",
      }),
    ).toEqual({ status: "disabled", search: "jane", offset: 40, pageSize: 50 });
  });

  it("falls back to null for an invalid status value", () => {
    expect(parseUsersRolesPermissionsSearchParams({ status: "banned" }).status).toBeNull();
  });

  it("clamps a negative offset to 0", () => {
    expect(parseUsersRolesPermissionsSearchParams({ offset: "-10" }).offset).toBe(0);
  });

  it("clamps an overlong search value to 255 characters", () => {
    const overlong = "x".repeat(400);
    expect(parseUsersRolesPermissionsSearchParams({ search: overlong }).search).toHaveLength(255);
  });

  it("takes the first value of a duplicated param", () => {
    expect(parseUsersRolesPermissionsSearchParams({ status: ["active", "disabled"] }).status).toBe(
      "active",
    );
  });
});

describe("buildUsersRolesPermissionsHref", () => {
  const baseQuery = { status: null, search: null, offset: 0, pageSize: 20 as const };

  it("returns the bare path with no query string for the default query", () => {
    expect(buildUsersRolesPermissionsHref(baseQuery, {})).toBe("/users-roles-and-permissions");
  });

  it("includes every non-default field", () => {
    expect(buildUsersRolesPermissionsHref(baseQuery, { status: "disabled", search: "jane" })).toBe(
      "/users-roles-and-permissions?status=disabled&search=jane",
    );
  });

  it("resets offset to 0 when any other field changes", () => {
    const withOffset = { ...baseQuery, offset: 40 };
    expect(buildUsersRolesPermissionsHref(withOffset, { status: "active" })).toBe(
      "/users-roles-and-permissions?status=active",
    );
  });

  it("preserves an explicit offset override", () => {
    expect(buildUsersRolesPermissionsHref(baseQuery, { offset: 20 })).toBe(
      "/users-roles-and-permissions?offset=20",
    );
  });

  it("includes a non-default pageSize", () => {
    expect(buildUsersRolesPermissionsHref(baseQuery, { pageSize: 50 })).toBe(
      "/users-roles-and-permissions?pageSize=50",
    );
  });
});

describe("adminUserStatusBadge", () => {
  it("maps active to healthy and disabled to unavailable", () => {
    expect(adminUserStatusBadge("active")).toEqual({ token: "healthy", label: "Active" });
    expect(adminUserStatusBadge("disabled")).toEqual({ token: "unavailable", label: "Disabled" });
  });
});

function userFixture(id: string, overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id,
    email: "jane@example.com",
    displayName: "Jane Doe",
    accountStatus: "active",
    lastLoginAt: null,
    createdAt: "2026-09-03T00:00:00.000Z",
    updatedAt: "2026-09-03T00:00:00.000Z",
    ...overrides,
  };
}

describe("getAdminUsers", () => {
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
      getAdminUsers({ status: null, search: null, offset: 0, pageSize: 20 }),
    ).rejects.toThrow(/Failed to load users/);
  });

  it("requests exactly the chosen page size (no +1 technique) — the backend returns a real total", async () => {
    const requestedUrls: string[] = [];
    global.fetch = vi.fn((url: string) => {
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          data: { rows: [], total: 0 },
          correlationId: "test",
        }),
      } as Response);
    }) as typeof fetch;

    await getAdminUsers({ status: "disabled", search: "jane", offset: 25, pageSize: 20 });

    expect(requestedUrls[0]).toBe(
      "https://api.example.com/users-roles-and-permissions/users?status=disabled&search=jane&limit=20&offset=25",
    );
  });

  it("returns the backend's rows and total verbatim", async () => {
    const rows = [userFixture("u1"), userFixture("u2", { accountStatus: "disabled" })];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { rows, total: 42 }, correlationId: "test" }),
    } as Response);

    const result = await getAdminUsers({ status: null, search: null, offset: 0, pageSize: 20 });
    expect(result.items).toEqual(rows);
    expect(result.total).toBe(42);
  });
});

describe("getAdminUserDetail", () => {
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
    const result = await getAdminUserDetail("not-a-uuid");
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns null on a 404", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getAdminUserDetail(VALID_ID)).toBeNull();
  });

  it("throws on a non-404 non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response);
    await expect(getAdminUserDetail(VALID_ID)).rejects.toThrow(/Failed to load user/);
  });

  it("returns the user detail on a 200", async () => {
    const detail: AdminUserDetail = {
      user: userFixture(VALID_ID),
      roleAssignments: [
        { roleId: "r1", roleKey: "super_admin", roleName: "Super Admin", projectId: null },
      ],
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: detail, correlationId: "test" }),
    } as Response);

    const result = await getAdminUserDetail(VALID_ID);
    expect(result?.user.id).toBe(VALID_ID);
    expect(result?.roleAssignments).toHaveLength(1);
  });
});

describe("getPermissionMatrix", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    vi.mocked(cookies).mockResolvedValue({ toString: () => "sid=abc" } as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("throws on a non-OK response — this page's entire content IS this data", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(getPermissionMatrix()).rejects.toThrow(/Failed to load the permission matrix/);
  });

  it("requests the matrix endpoint and returns the backend's shape verbatim", async () => {
    const matrix: PermissionMatrix = {
      roles: [{ id: "r1", key: "super_admin", name: "Super Admin" }],
      modules: [{ id: "m1", key: "projects", name: "Projects" }],
      grants: [{ roleId: "r1", moduleId: "m1", action: "view" }],
    };
    const requestedUrls: string[] = [];
    global.fetch = vi.fn((url: string) => {
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: matrix, correlationId: "test" }),
      } as Response);
    }) as typeof fetch;

    const result = await getPermissionMatrix();
    expect(requestedUrls[0]).toBe("https://api.example.com/users-roles-and-permissions/matrix");
    expect(result).toEqual(matrix);
  });
});
