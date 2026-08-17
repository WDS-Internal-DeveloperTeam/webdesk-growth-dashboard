import { Op, type Model } from "sequelize";
import { getAuthModels } from "./models.js";
import type { UserEntity } from "./entities.js";

const DEFAULT_SEARCH_LIMIT = 20;
const MAX_SEARCH_LIMIT = 200;

/** Escapes `%`, `_`, and the escape character itself so a literal substring search (e.g. an email
 *  fragment containing a real underscore) isn't reinterpreted by Postgres as a partial ILIKE
 *  wildcard pattern — this is a match-correctness fix, not a SQL-injection concern (Sequelize
 *  already parameterizes the value). */
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function toEntity(instance: Model): UserEntity {
  const json = instance.toJSON() as Record<string, unknown>;
  return {
    id: json.id as string,
    email: json.email as string,
    displayName: json.displayName as string,
    accountStatus: json.accountStatus as UserEntity["accountStatus"],
    lastLoginAt: json.lastLoginAt instanceof Date ? json.lastLoginAt.toISOString() : null,
    createdAt: (json.createdAt as Date).toISOString(),
    updatedAt: (json.updatedAt as Date).toISOString(),
  };
}

/**
 * Pre-provisioned-only lookup (resolved this session,
 * docs/task-packages/phase-1c-authentication-sessions.md §2): this
 * repository never creates a user as a side effect of a login attempt —
 * `findByEmail` returning `null` means the caller rejects the login, it
 * never falls through to `create`.
 */
export class UserRepository {
  private readonly model = getAuthModels().User;

  async findById(id: string): Promise<UserEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntity(instance) : null;
  }

  /** `email` must already be lowercased by the caller — this repository does not normalize it. */
  async findByEmail(email: string): Promise<UserEntity | null> {
    const instance = await this.model.findOne({ where: { email } });
    return instance ? toEntity(instance) : null;
  }

  /** Provisioning is an out-of-band, administrator-driven action (Task 8, separate authorization) — exposed here only for the CLI seed script and tests. */
  async create(input: {
    email: string;
    displayName: string;
    accountStatus?: "active" | "disabled";
  }): Promise<UserEntity> {
    const instance = await this.model.create({
      email: input.email,
      displayName: input.displayName,
      accountStatus: input.accountStatus ?? "active",
    });
    return toEntity(instance);
  }

  async recordSuccessfulLogin(id: string, loginAt: Date): Promise<void> {
    await this.model.update({ lastLoginAt: loginAt }, { where: { id } });
  }

  /**
   * Read-only identity lookup for picker UIs (project owner/team/approver assignment) — not part
   * of Task 8's user-management CRUD (create/edit/deactivate a user remain that separate,
   * not-yet-authorized scope; this method only ever reads). Always excludes `disabled` accounts
   * (Sequelize's `paranoid: true` already excludes soft-deleted rows by default) — a picker should
   * never offer a user who can no longer sign in or has been offboarded.
   */
  async search(
    filter: { search?: string; limit?: number; offset?: number } = {},
  ): Promise<readonly UserEntity[]> {
    const limit = Math.min(filter.limit ?? DEFAULT_SEARCH_LIMIT, MAX_SEARCH_LIMIT);
    const rows = await this.model.findAll({
      where: {
        accountStatus: "active",
        ...(filter.search
          ? (() => {
              const pattern = `%${escapeLikePattern(filter.search)}%`;
              return {
                [Op.or]: [
                  { email: { [Op.iLike]: pattern } },
                  { displayName: { [Op.iLike]: pattern } },
                ],
              };
            })()
          : {}),
      },
      order: [["displayName", "ASC"]],
      limit,
      offset: filter.offset ?? 0,
    });
    return rows.map((row) => toEntity(row));
  }

  /**
   * Batch counterpart to `search()`/`findById()` — resolves many ids in a single query instead of
   * N round trips (e.g. resolving every user currently holding a project-scoped role). Silently
   * drops any id that doesn't resolve to an active user, extending the same "disabled = not found"
   * convention `findById()` already applies per-id to the batch case — a caller filters the
   * returned array against its input ids if it needs to know which ones were dropped.
   */
  async findByIds(ids: readonly string[]): Promise<readonly UserEntity[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.model.findAll({
      where: { id: { [Op.in]: ids }, accountStatus: "active" },
    });
    return rows.map((row) => toEntity(row));
  }
}
