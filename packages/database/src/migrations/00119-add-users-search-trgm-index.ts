import type { QueryInterface } from "sequelize";

/**
 * Supports the "Users, Roles and Permissions" module's own admin-directory search
 * (`UserRepository.listAll()`'s `ILIKE '%...%'` filter over `users.email`/`users.display_name`) —
 * no supporting index existed for either column (code-review finding, this branch). Mirrors every
 * sibling content-library module's own established fuzzy-search-index precedent (e.g.
 * `releases_title_trgm_idx` in `00111-create-release-center.ts`, `technical_check_definitions_
 * name_trgm_idx`/`scan_definitions_name_trgm_idx`) — one `pg_trgm` GIN trigram index per searched
 * column, since both `email` and `display_name` are independently `ILIKE`d via `Op.or`.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.sequelize.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
  await context.sequelize.query(
    "CREATE INDEX users_email_trgm_idx ON users USING gin (email gin_trgm_ops);",
  );
  await context.sequelize.query(
    "CREATE INDEX users_display_name_trgm_idx ON users USING gin (display_name gin_trgm_ops);",
  );
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.sequelize.query("DROP INDEX IF EXISTS users_display_name_trgm_idx;");
  await context.sequelize.query("DROP INDEX IF EXISTS users_email_trgm_idx;");
}
