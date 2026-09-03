import { Op, type Model } from "sequelize";
import { getAuthModels } from "./models.js";
import type { UserEntity } from "./entities.js";

const DEFAULT_SEARCH_LIMIT = 20;
const MAX_SEARCH_LIMIT = 200;
const DEFAULT_LIST_LIMIT = 20;
// 200, not 100: dashboard-web list pages request pageSize + 1 (up to 101 at the largest 100-row
// page size) to detect a next page — matches every sibling list-query schema's own 200 ceiling
// (see users-roles-permissions.dto.ts's own doc comment for the real production incident this
// mismatch already caused once, on the Decision and Activity Log module).
const MAX_LIST_LIMIT = 200;

/** Escapes `%`, `_`, and the escape character itself so a literal substring search (e.g. an email
 *  fragment containing a real underscore) isn't reinterpreted by Postgres as a partial ILIKE
 *  wildcard pattern — this is a match-correctness fix, not a SQL-injection concern (Sequelize
 *  already parameterizes the value). Exported so other repositories' own `Op.iLike` search
 *  filters can reuse it instead of hand-rolling (or omitting) the identical escape (code-review
 *  finding, `module-service-library`). */
export function escapeLikePattern(value: string): string {
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

  /**
   * Admin directory list (`users-roles-permissions` module) — deliberately NOT `search()` above:
   * that method is picker-only and hardcodes `accountStatus: "active"`, since a picker should
   * never offer a disabled/offboarded user. This one is an admin surface that must show every
   * user regardless of status by default, and lets a caller filter to exactly one status when
   * given. Returns the real total count (via `findAndCountAll`) alongside the page of rows, so a
   * caller can render real pagination instead of a `limit+1`/"has more" heuristic.
   */
  async listAll(
    filter: {
      search?: string;
      status?: "active" | "disabled";
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ rows: readonly UserEntity[]; total: number }> {
    const limit = Math.min(filter.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const where = {
      ...(filter.status ? { accountStatus: filter.status } : {}),
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
    };
    const { rows, count } = await this.model.findAndCountAll({
      where,
      // `id` is a secondary sort key so ties on `displayName` don't shift order between two
      // separate paginated queries — the same tiebreaker fix already applied to
      // `ContentTemplateRepository.list()`/`PersonaRepository`/`ServiceRepository` for an
      // identical, previously-fixed bug class in this codebase's history.
      order: [
        ["displayName", "ASC"],
        ["id", "ASC"],
      ],
      limit,
      offset: filter.offset ?? 0,
    });
    return { rows: rows.map((row) => toEntity(row)), total: count };
  }

  /**
   * Atomic update-and-return, mirroring `BrandLibraryRecordRepository.update()`'s own
   * `returning: true` pattern — a single `UPDATE ... RETURNING` instead of a write followed by a
   * separate re-fetch (a bug class this project's own code reviews have caught and fixed
   * repeatedly). Returns `null` if no row with `id` exists, letting the caller decide whether that
   * is a 404.
   *
   * `expectedStatus` is an optional CAS guard, mirroring `ContentTemplateRepository.update()`'s/
   * `PageRepository.update()`'s own `expectedApprovalStatus`/`expectedWorkflowStage` parameter
   * (a previously-fixed bug class in this codebase): without it, `UsersDirectoryService
   * .updateStatus()` reads the target's current status into application memory before writing,
   * but the actual write here would still be unconditional — a concurrent status change landing
   * between that read and this write could silently overwrite it. When given, the caller gets
   * back `null` for BOTH "no such row" and "the row's status no longer matches what was read" —
   * the service distinguishes the two using its own earlier `findById()` result, matching the
   * established convention.
   */
  async updateStatus(
    id: string,
    status: "active" | "disabled",
    expectedStatus?: "active" | "disabled",
  ): Promise<UserEntity | null> {
    const where: Record<string, unknown> = { id };
    if (expectedStatus) {
      where.accountStatus = expectedStatus;
    }
    const [affectedCount, affectedRows] = await this.model.update(
      { accountStatus: status },
      { where, returning: true },
    );
    if (affectedCount === 0 || !affectedRows[0]) {
      return null;
    }
    return toEntity(affectedRows[0]);
  }
}
