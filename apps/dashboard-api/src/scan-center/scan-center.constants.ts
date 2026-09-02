/** NestJS DI tokens for the Scan Center module — same pattern as
 *  ../internal-linking-library/internal-linking-library.constants.ts. */
export const SCAN_DEFINITION_REPOSITORY = Symbol("SCAN_DEFINITION_REPOSITORY");
export const SCAN_RUN_REPOSITORY = Symbol("SCAN_RUN_REPOSITORY");
export const SCAN_FINDING_REPOSITORY = Symbol("SCAN_FINDING_REPOSITORY");
export const SCAN_EVIDENCE_REPOSITORY = Symbol("SCAN_EVIDENCE_REPOSITORY");

/** The real, seeded RBAC group key (`06_Roles_and_Permissions.md`,
 *  `00013-seed-rbac-matrix.ts:217-225`, `key: "scans"`) — distinct from
 *  `module_registry.key = "scan_center"` (`00015-seed-module-registry.ts:111`,
 *  `permissionGroupKey: "scans"`). Declared once here, not independently in every service/
 *  controller, so a future RBAC-key rename can't silently diverge across the four sub-modules.
 *
 * The seeded matrix for this group has no `submit`/`approve`/`publish` actions at all — only
 * `view`/`create`/`edit`/`review`/`configure` (V/C/E/R/M). This module's own status-transition
 * routes are gated accordingly: scan-run transitions require `edit` (a uniform action for every
 * transition, unlike Internal Linking Library's/Keyword & Entity Library's submit/review/approve
 * split, which this RBAC group simply doesn't have the letters for); scan-finding transitions
 * require `review` (matching the letter's own natural fit — a QA/security reviewer disposing of a
 * finding). `configure` (`M`, super_admin-only) is left unused in this pass, matching the
 * established precedent of leaving a genuinely unused seeded action unwired rather than fabricating
 * a mechanism for it (Content Template Library's own original `publish`/`unpublish` gap, later
 * given a real mechanism only once a concrete need existed).
 */
export const SCAN_CENTER_MODULE_KEY = "scans";
