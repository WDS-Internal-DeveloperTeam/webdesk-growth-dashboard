import type { UserEntity, UserRepository } from "@webdesk/database";
import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UsersService } from "./users.service.js";

function userFixture(overrides: Partial<UserEntity> = {}): UserEntity {
  return {
    id: "user-1",
    email: "jane@example.com",
    displayName: "Jane Doe",
    accountStatus: "active",
    lastLoginAt: null,
    createdAt: "2026-08-17T00:00:00.000Z",
    updatedAt: "2026-08-17T00:00:00.000Z",
    ...overrides,
  };
}

describe("UsersService", () => {
  let users: { search: ReturnType<typeof vi.fn>; findById: ReturnType<typeof vi.fn> };
  let service: UsersService;

  beforeEach(() => {
    users = { search: vi.fn(), findById: vi.fn() };
    service = new UsersService(users as unknown as UserRepository);
  });

  describe("search", () => {
    it("narrows each result to id/displayName/email only — never accountStatus/lastLoginAt/timestamps", async () => {
      users.search.mockResolvedValue([userFixture()]);

      const result = await service.search({ search: "jane" });

      expect(result).toEqual([
        { id: "user-1", displayName: "Jane Doe", email: "jane@example.com" },
      ]);
      expect(users.search).toHaveBeenCalledWith({
        search: "jane",
        limit: undefined,
        offset: undefined,
      });
    });
  });

  describe("findById", () => {
    it("returns the narrowed summary for an active user", async () => {
      users.findById.mockResolvedValue(userFixture());

      expect(await service.findById("user-1")).toEqual({
        id: "user-1",
        displayName: "Jane Doe",
        email: "jane@example.com",
      });
    });

    it("throws NotFoundException for a nonexistent user", async () => {
      users.findById.mockResolvedValue(null);
      await expect(service.findById("missing")).rejects.toThrow(NotFoundException);
    });

    it("throws NotFoundException for a disabled user — same as nonexistent, per the picker's own contract", async () => {
      users.findById.mockResolvedValue(userFixture({ accountStatus: "disabled" }));
      await expect(service.findById("user-1")).rejects.toThrow(NotFoundException);
    });
  });
});
