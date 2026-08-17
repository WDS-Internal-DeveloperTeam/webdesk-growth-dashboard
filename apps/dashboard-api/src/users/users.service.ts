import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { UserRepository } from "@webdesk/database";
import { USER_REPOSITORY } from "../auth/config/auth.constants.js";
import type { SearchUsersQueryDto } from "./users.dto.js";

/** The narrowest projection a picker UI needs — see `packages/shared-types`'s `UserSummary` for
 *  why `accountStatus`/`lastLoginAt`/timestamps are deliberately left out. */
export interface UserSummary {
  readonly id: string;
  readonly displayName: string;
  readonly email: string;
}

/**
 * Read-only identity lookup (owner/team/approver picker UIs across the Projects module and any
 * future module that needs one) — not Task 8's user-management CRUD, which remains its own,
 * separate, not-yet-authorized scope (`apps/dashboard-api/src/auth/auth.module.ts`'s own doc
 * comment). This service never creates, edits, or deactivates a user; it only searches existing
 * ones.
 */
@Injectable()
export class UsersService {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  async search(query: SearchUsersQueryDto): Promise<readonly UserSummary[]> {
    const rows = await this.users.search({
      search: query.search,
      limit: query.limit,
      offset: query.offset,
    });
    return rows.map((row) => ({ id: row.id, displayName: row.displayName, email: row.email }));
  }

  /** Resolves a single, already-known user id to a display summary — e.g. so an edit form can show
   *  who a project's current owner is before the picker's own search is ever used. Throws
   *  `NotFoundException` for a disabled or nonexistent user, same convention as
   *  `ProjectService.findById()` — a disabled account is treated as not-found for lookup purposes,
   *  consistent with `search()` already filtering to active-only. */
  async findById(userId: string): Promise<UserSummary> {
    const user = await this.users.findById(userId);
    if (!user || user.accountStatus !== "active") {
      throw new NotFoundException(`User not found: ${userId}`);
    }
    return { id: user.id, displayName: user.displayName, email: user.email };
  }
}
