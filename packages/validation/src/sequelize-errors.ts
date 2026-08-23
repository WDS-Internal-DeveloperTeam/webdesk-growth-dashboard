/**
 * `dashboard-api` never imports `sequelize` directly (ADR-0006 — only `packages/database` may),
 * so every service that needs to detect a unique-constraint violation checks the error by its
 * fixed, documented class name instead of `instanceof`. That check was hand-copied verbatim
 * across 7 call sites in 5 modules (Website Strategy Center, Proof and Claims Library, Persona
 * Library, and — as of the Page Inventory build — a 3rd new occurrence within a single PR) before
 * being extracted here (code-review finding, `module-page-inventory`).
 */
export function isSequelizeUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && error.name === "SequelizeUniqueConstraintError";
}
