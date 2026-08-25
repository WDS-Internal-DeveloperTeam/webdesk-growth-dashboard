import type { UserEntity, UserRepository } from "@webdesk/database";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UsersService } from "./users.service.js";

const VALID_USER_ID = "11111111-1111-1111-1111-111111111111";
const WELL_FORMED_NONEXISTENT_ID = "99999999-9999-9999-9999-999999999999";

function userFixture(overrides: Partial<UserEntity> = {}): UserEntity {
  return {
    id: VALID_USER_ID,
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
  let users: {
    search: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByIds: ReturnType<typeof vi.fn>;
  };
  let service: UsersService;

  beforeEach(() => {
    users = { search: vi.fn(), findById: vi.fn(), findByIds: vi.fn() };
    service = new UsersService(users as unknown as UserRepository);
  });

  describe("search", () => {
    it("narrows each result to id/displayName/email only — never accountStatus/lastLoginAt/timestamps", async () => {
      users.search.mockResolvedValue([userFixture()]);

      const result = await service.search({ search: "jane" });

      expect(result).toEqual([
        { id: VALID_USER_ID, displayName: "Jane Doe", email: "jane@example.com" },
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

      expect(await service.findById(VALID_USER_ID)).toEqual({
        id: VALID_USER_ID,
        displayName: "Jane Doe",
        email: "jane@example.com",
      });
    });

    it("throws NotFoundException for a well-formed but nonexistent user id", async () => {
      users.findById.mockResolvedValue(null);
      await expect(service.findById(WELL_FORMED_NONEXISTENT_ID)).rejects.toThrow(NotFoundException);
    });

    it("throws NotFoundException for a disabled user — same as nonexistent, per the picker's own contract", async () => {
      users.findById.mockResolvedValue(userFixture({ accountStatus: "disabled" }));
      await expect(service.findById(VALID_USER_ID)).rejects.toThrow(NotFoundException);
    });

    it("throws NotFoundException for a malformed (non-UUID) id, without ever calling the repository", async () => {
      await expect(service.findById("not-a-uuid")).rejects.toThrow(NotFoundException);
      expect(users.findById).not.toHaveBeenCalled();
    });
  });

  describe("findByIds", () => {
    it("resolves multiple ids in a single repository call, narrowed to display summaries", async () => {
      users.findByIds.mockResolvedValue([
        userFixture(),
        userFixture({ id: WELL_FORMED_NONEXISTENT_ID }),
      ]);

      const result = await service.findByIds([VALID_USER_ID, WELL_FORMED_NONEXISTENT_ID]);

      expect(users.findByIds).toHaveBeenCalledWith([VALID_USER_ID, WELL_FORMED_NONEXISTENT_ID]);
      expect(result).toEqual([
        { id: VALID_USER_ID, displayName: "Jane Doe", email: "jane@example.com" },
        { id: WELL_FORMED_NONEXISTENT_ID, displayName: "Jane Doe", email: "jane@example.com" },
      ]);
    });

    it("filters out a malformed id before it ever reaches the repository", async () => {
      users.findByIds.mockResolvedValue([userFixture()]);

      await service.findByIds([VALID_USER_ID, "not-a-uuid"]);

      expect(users.findByIds).toHaveBeenCalledWith([VALID_USER_ID]);
    });
  });

  describe("assertUserExists", () => {
    it("resolves without throwing for an active user", async () => {
      users.findById.mockResolvedValue(userFixture());
      await expect(
        service.assertUserExists(VALID_USER_ID, "assignedToUserId"),
      ).resolves.toBeUndefined();
    });

    it("throws BadRequestException (not NotFoundException) for a well-formed but nonexistent user id", async () => {
      users.findById.mockResolvedValue(null);
      await expect(
        service.assertUserExists(WELL_FORMED_NONEXISTENT_ID, "assignedToUserId"),
      ).rejects.toThrow(BadRequestException);
    });

    it("includes the caller-supplied field name in the error message", async () => {
      users.findById.mockResolvedValue(null);
      await expect(
        service.assertUserExists(WELL_FORMED_NONEXISTENT_ID, "delegateToUserId"),
      ).rejects.toThrow(/delegateToUserId/);
    });

    it("throws BadRequestException for a disabled user, same as nonexistent", async () => {
      users.findById.mockResolvedValue(userFixture({ accountStatus: "disabled" }));
      await expect(service.assertUserExists(VALID_USER_ID, "assignedToUserId")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("throws BadRequestException for a malformed id, without calling the repository", async () => {
      await expect(service.assertUserExists("not-a-uuid", "assignedToUserId")).rejects.toThrow(
        BadRequestException,
      );
      expect(users.findById).not.toHaveBeenCalled();
    });
  });
});
