/** NestJS DI token for the Change Center module — same pattern as
 *  ../scan-center/scan-center.constants.ts. */
export const CHANGE_RECORD_REPOSITORY = Symbol("CHANGE_RECORD_REPOSITORY");

/**
 * The real, seeded RBAC group key (`06_Roles_and_Permissions.md`,
 * `00013-seed-rbac-matrix.ts:226-234`, `key: "change_center"`) — matches
 * `module_registry.key = "change_center"` too (`00035-populate-module-registry-fields.ts:485`),
 * unlike Scan Center's own `scans`/`scan_center` split.
 *
 * The seeded matrix for this group has five actions: `view`/`create`/`edit`/`review`/`approve`
 * (V/C/E/R/A — no `submit`/`publish`/`configure`/`export` letters at all). `super_admin`/
 * `owner_growth_approver` hold all five (`VCERA`); `marketing_editor`/`designer_creative_reviewer`/
 * `developer`/`qa_security_reviewer` hold only `view`/`review`/`approve` (`VRA` — no `create`/
 * `edit`), matching Review and Approval Center's own "only two roles can create" shape;
 * `read_only` holds only `view`.
 *
 * Action mapping used by `ChangeRecordsService`: `create` gates the create route; `edit` gates
 * in-place content edits (recordLabel/notes/assignment while still `detected`/`under_review`) —
 * NOT a status transition; `review` gates the review/decision transitions
 * (`detected -> under_review`, `under_review -> accepted|rejected|deferred|
 * manual_merge_required`, `manual_merge_required -> accepted|rejected|deferred`,
 * `deferred -> under_review`); `approve` gates the whole apply+verify tail
 * (`accepted -> applying`, `applying -> applied|apply_failed`, `apply_failed -> applying`,
 * `applied -> verified`) — there is no separate seeded "apply"/"verify" action letter, so both
 * halves of that tail share the one `approve` grant, mirroring how this RBAC group's own letter
 * set forced Internal Linking Library's `submit`/`review`/`approve` split into whatever the
 * seeded letters actually support rather than an invented ideal split.
 *
 * The `assigned_to_user_id`-based `assignedToMe` list filter is NOT real object-level access
 * control — per this codebase's own already-established precedent (Review and Approval Center's
 * own identical `assignedToMe` filter, `docs/security/threat-model-authorization-rbac.md`'s own
 * explicit note that a role's own "(assigned)" qualifier in the matrix is a blanket role grant,
 * not per-object enforcement), it is a pure app-level list-filter convenience only.
 */
export const CHANGE_CENTER_MODULE_KEY = "change_center";
