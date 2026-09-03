/** NestJS DI tokens for the Release Center module — same pattern as
 *  ../technical-center/technical-center.constants.ts. */
export const RELEASE_REPOSITORY = Symbol("RELEASE_REPOSITORY");
export const RELEASE_ARTIFACT_REPOSITORY = Symbol("RELEASE_ARTIFACT_REPOSITORY");
export const RELEASE_APPROVAL_REPOSITORY = Symbol("RELEASE_APPROVAL_REPOSITORY");
export const DEPLOYMENT_REPOSITORY = Symbol("DEPLOYMENT_REPOSITORY");
export const SMOKE_TEST_REPOSITORY = Symbol("SMOKE_TEST_REPOSITORY");
export const ROLLBACK_RECORD_REPOSITORY = Symbol("ROLLBACK_RECORD_REPOSITORY");

/** The real, seeded RBAC group key (`06_Roles_and_Permissions.md`, `00013-seed-rbac-matrix.ts:253`,
 *  `key: "releases"`) — distinct from `module_registry.key = "release_center"`
 *  (`00015-seed-module-registry.ts:123`, `permissionGroupKey: "releases"`). Declared once here, not
 *  independently in every service/controller, so a future RBAC-key rename can't silently diverge
 *  across the module's four sub-resources.
 *
 * The seeded matrix for this group (letter legend per `00013-seed-rbac-matrix.ts`'s own
 * comment — V=view, C=create, E=edit, S=submit, R=review, A=approve, L=release/rollback, expands
 * to TWO actions: `release`, `rollback`):
 *   super_admin              VCERAL (view, create, edit, review, approve, release, rollback)
 *   owner_growth_approver    VCRAL  (view, create, review, approve, release, rollback — NOT edit)
 *   marketing_editor         V      (view only)
 *   designer_creative_reviewer V    (view only)
 *   developer                VCESR  (view, create, edit, submit, review — NOT approve/release)
 *   qa_security_reviewer     VRA    (view, review, approve — NOT create/edit/submit/release)
 *   read_only                V      (view only)
 *
 * `view`/`create`/`edit` gate the content routes directly (`edit` is content edits, blocked once
 * `status` is `completed`/`rolled_back`/`checks_failed` — D1's own doc comment). The one
 * status-transition route (`POST .../releases/:id/status`) is gated only on `view` at the route
 * level, with the real per-transition action (`submit`/`review`/`approve`/`release`, the last
 * covering both the seeded `release` and `rollback` actions) checked dynamically inside
 * `ReleasesService.changeStatus()` against the `TRANSITIONS` map — the same layered pattern
 * `TechnicalCheckRunsController.changeStatus()`/`CaseStudiesController.changeStatus()` both
 * already established.
 */
export const RELEASE_CENTER_MODULE_KEY = "releases";

/** Once a release is `completed`/`rolled_back`, every sub-resource write against it is rejected —
 *  a single shared constant, not an independently re-declared `Set` per sub-resource service
 *  (code-review finding: `deployments.service.ts`/`smoke-tests.service.ts` originally had NO such
 *  guard on `create()` at all, unlike `release-artifacts.service.ts`'s own `remove()`, letting a
 *  caller fabricate a "succeeded" deployment or "passed" smoke test against an already-locked
 *  release). Used to guard every sub-resource write (artifact delete, deployment create, smoke-test
 *  create) uniformly. */
export const RELEASE_TERMINAL_STATUSES: ReadonlySet<string> = new Set(["completed", "rolled_back"]);
