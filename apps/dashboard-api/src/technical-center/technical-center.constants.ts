/** NestJS DI tokens for the Technical Center module — same pattern as
 *  ../scan-center/scan-center.constants.ts. */
export const TECHNICAL_CHECK_DEFINITION_REPOSITORY = Symbol(
  "TECHNICAL_CHECK_DEFINITION_REPOSITORY",
);
export const TECHNICAL_CHECK_RUN_REPOSITORY = Symbol("TECHNICAL_CHECK_RUN_REPOSITORY");
export const TECHNICAL_FINDING_REPOSITORY = Symbol("TECHNICAL_FINDING_REPOSITORY");

/** The real, seeded RBAC group key (`06_Roles_and_Permissions.md`,
 *  `00013-seed-rbac-matrix.ts:145-153`, `key: "development_code"`) — distinct from
 *  `module_registry.key = "technical_center"` (`00015-seed-module-registry.ts:122`,
 *  `permissionGroupKey: "development_code"`). Declared once here, not independently in every
 *  service/controller, so a future RBAC-key rename can't silently diverge across the module's
 *  three sub-modules.
 *
 * The seeded matrix for this group (letter legend per `00013-seed-rbac-matrix.ts`'s own
 * comment — V=view, C=create, E=edit, S=submit, R=review, A=approve, L=release/rollback):
 *   super_admin              VCERL  (view, create, edit, review, release, rollback)
 *   owner_growth_approver    VRL    (view, review, release, rollback — NOT create/edit)
 *   marketing_editor         V      (view only)
 *   designer_creative_reviewer V    (view only)
 *   developer                VCES   (view, create, edit, submit — NOT review/approve)
 *   qa_security_reviewer     VRA    (view, review, approve — NOT create/edit/submit)
 *   read_only                V      (view only)
 *
 * This module's own status-transition routes mirror Scan Center's own gating choice as closely as
 * this group's actual letters allow: check-run transitions require `edit` (the role that can
 * create/edit a definition — `developer`/`super_admin` — is also the role that drives a run
 * through its own execution lifecycle, the identical reasoning `scans`' own `edit`-gated
 * `scan_runs` transitions use); technical-finding disposition transitions require `review`
 * (matching the letter's own natural fit — `super_admin`/`owner_growth_approver`/
 * `qa_security_reviewer` disposing of an issue a developer surfaced, mirroring `scans`' own
 * `review`-gated `scan_findings` transitions exactly).
 *
 * `submit` (`S`, `developer`-only) and `approve` (`A`, `qa_security_reviewer`-only) are left
 * unwired in this pass — this module's own two workflows (a run's execution lifecycle, a
 * finding's disposition lifecycle) don't have a natural third gate to hang a submit/approve step
 * on without inventing one the canonical spec never named. `release`/`rollback` (`L`) are left
 * unwired too — neither concept maps onto a check definition/run/finding; `release_center`
 * (module `release_center`) is this matrix's own real consumer of that pair. Both left-unwired
 * groups match the established precedent of leaving a genuinely unused seeded action unwired
 * rather than fabricating a mechanism for it (`SCAN_CENTER_MODULE_KEY`'s own doc comment, on
 * `scans`' unused `configure`/`M`).
 */
export const TECHNICAL_CENTER_MODULE_KEY = "development_code";
