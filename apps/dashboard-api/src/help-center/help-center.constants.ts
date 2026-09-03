/** NestJS DI token for the Help Center module — same one-file-per-module pattern every sibling
 *  module owns independently. */
export const HELP_ARTICLE_REPOSITORY = Symbol("HELP_ARTICLE_REPOSITORY");

/** The RBAC group key (`06_Roles_and_Permissions.md`, `00013-seed-rbac-matrix.ts`) — distinct
 *  from `module_registry.key = "help_center"`. Reuses the already-seeded `system_settings` group
 *  verbatim (confirmed directly with the project owner) rather than a new dedicated group; only
 *  `super_admin`/`owner_growth_approver` hold any grant on it at all. Declared once here, not
 *  independently in both the service and the controller, mirroring
 *  `CONTENT_TEMPLATE_LIBRARY_MODULE_KEY`'s own established pattern. */
export const HELP_CENTER_MODULE_KEY = "system_settings";
