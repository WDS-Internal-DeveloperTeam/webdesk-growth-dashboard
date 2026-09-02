/** NestJS DI tokens for the Import and Export Center module — same pattern as
 *  ../change-center/change-center.constants.ts. */
export const IMPORT_TEMPLATE_REPOSITORY = Symbol("IMPORT_TEMPLATE_REPOSITORY");
export const IMPORT_RUN_REPOSITORY = Symbol("IMPORT_RUN_REPOSITORY");
export const IMPORT_ROW_REPOSITORY = Symbol("IMPORT_ROW_REPOSITORY");
export const IMPORT_ERROR_REPOSITORY = Symbol("IMPORT_ERROR_REPOSITORY");
export const EXPORT_RUN_REPOSITORY = Symbol("EXPORT_RUN_REPOSITORY");

/**
 * Two distinct, already-seeded RBAC group keys (`06_Roles_and_Permissions.md`,
 * `00013-seed-rbac-matrix.ts:235-252`), both matching `module_registry.key =
 * "import_and_export_center"`'s own seed comment (`00015-seed-module-registry.ts:113-117`):
 * "Source module #34 covers both import and export; kept as ONE registry row... Gated here by
 * `imports` as its primary permission group — export-specific checks... must reference the
 * `exports` permission group directly."
 *
 * `imports` (`00013-seed-rbac-matrix.ts:235-242`) has a real seven-letter action set —
 * `view`/`create`/`edit`/`submit`/`review`/`approve`/`export` (V/C/E/S/R/A/X). `super_admin`/
 * `owner_growth_approver` hold `VCERAX` (no `S` — the top tier never needs to submit their own
 * work for someone else's review); the four mid-tier roles hold `VCSEX` (no `R`/`A` — they can
 * create/submit/edit, never review or approve); `read_only` holds `V`. `import_templates`/
 * `import_runs`/`import_rows`/`import_errors` are all gated on this group. The dynamic
 * per-transition action mapping lives in `import-runs.service.ts`'s own `TRANSITIONS` table — a
 * real two-tier submit/review/approve gate, the same dynamic-per-transition-action pattern
 * Service Library/Persona Library/Website Strategy Center already established, NOT Scan Center's
 * uniform-`edit` pattern (whose `scans` group has no S/R/A letters to split on). The group's own
 * `M` (configure) letter is absent entirely — nothing to leave unwired.
 *
 * `exports` (`00013-seed-rbac-matrix.ts:244-252`) has only `view`/`export` (V/X) — no `create`
 * letter at all, since creating an export run IS the `export` action. Every role except
 * `read_only` holds `VX`; `read_only` holds only `V`. `export_runs` is gated on this group, with
 * every mutating action (create AND every status transition) requiring `export`.
 *
 * Both groups' own matrix rows carry an `(assigned)` qualifier — deliberately NOT encoded here
 * (object-level "only records assigned to me" scoping is a future feature's own responsibility),
 * matching Review Center's/Change Center's own already-accepted precedent.
 */
export const IMPORTS_MODULE_KEY = "imports";
export const EXPORTS_MODULE_KEY = "exports";
