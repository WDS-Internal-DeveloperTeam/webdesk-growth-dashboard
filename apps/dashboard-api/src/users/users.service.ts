import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { UserEntity, UserRepository } from "@webdesk/database";
import type { UserSummary } from "@webdesk/shared-types";
import { USER_REPOSITORY } from "../auth/config/auth.constants.js";
import type { SearchUsersQueryDto } from "./users.dto.js";

/** Same UUID short-circuit `apps/dashboard-web/lib/users.ts`'s `getUser()` already uses — a
 *  malformed id is the honest read of a garbled value (treated as not-found), not a lookup worth
 *  sending to Postgres, whose `uuid` column type rejects it with a raw driver error instead of a
 *  clean 404. */
const USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The narrowest projection a picker UI needs — see `packages/shared-types`'s `UserSummary` for
 *  why `accountStatus`/`lastLoginAt`/timestamps are deliberately left out. */
function toUserSummary(user: UserEntity): UserSummary {
  return { id: user.id, displayName: user.displayName, email: user.email };
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
    return rows.map(toUserSummary);
  }

  /** Resolves a single, already-known user id to a display summary — e.g. so an edit form can show
   *  who a project's current owner is before the picker's own search is ever used. Throws
   *  `NotFoundException` for a malformed id, a disabled account, or a nonexistent user — all three
   *  are treated as not-found for lookup purposes (same convention as `ProjectService.findById()`),
   *  consistent with `search()` already filtering to active-only. A malformed id is rejected before
   *  ever reaching the repository, since Postgres's `uuid` column type would otherwise reject it
   *  with a raw driver error the global exception filter turns into an opaque 500. */
  async findById(userId: string): Promise<UserSummary> {
    if (!USER_ID_PATTERN.test(userId)) {
      throw new NotFoundException(`User not found: ${userId}`);
    }
    const user = await this.users.findById(userId);
    if (!user || user.accountStatus !== "active") {
      throw new NotFoundException(`User not found: ${userId}`);
    }
    return toUserSummary(user);
  }
}
