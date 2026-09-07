/** NestJS DI tokens for the Integrations module — same pattern as
 *  ../scan-center/scan-center.constants.ts. */
export const INTEGRATION_REPOSITORY = Symbol("INTEGRATION_REPOSITORY");
export const INTEGRATION_ENVIRONMENT_REPOSITORY = Symbol("INTEGRATION_ENVIRONMENT_REPOSITORY");
export const WEBHOOK_EVENT_REPOSITORY = Symbol("WEBHOOK_EVENT_REPOSITORY");
export const SECRET_METADATA_REPOSITORY = Symbol("SECRET_METADATA_REPOSITORY");

/** The real, seeded RBAC group key (`06_Roles_and_Permissions.md`,
 *  `00013-seed-rbac-matrix.ts:266-269`, `key: "system_settings"`) — distinct from
 *  `module_registry.key = "integrations"` (`00015-seed-module-registry.ts:143`,
 *  `permissionGroupKey: "system_settings"`). Declared once here, not independently in every
 *  service/controller, so a future RBAC-key rename can't silently diverge across files, mirroring
 *  `SCAN_CENTER_MODULE_KEY`'s/`BRAND_LIBRARY_MODULE_KEY`'s own identical fix pattern.
 *
 * The seeded matrix for `system_settings` is `super_admin: VCERM`, `owner_growth_approver: VM` —
 * only two roles hold anything at all. Action mapping (per `docs/implementation/module-
 * integrations.md`'s own scope): `view` — list/get on all four tables; `create` — create an
 * `integrations`/`integration_environments`/`secret_metadata` row, and record a `webhook_events`
 * entry; `edit` — update/delete (delete only where allowed per-table); `review` — record a
 * verification result (`POST /integrations/:id/verify`); `configure` (`M`) — toggle `isActive`
 * (`POST /integrations/:id/toggle-active`), the one action `owner_growth_approver` can take beyond
 * viewing.
 */
export const INTEGRATIONS_MODULE_KEY = "system_settings";
