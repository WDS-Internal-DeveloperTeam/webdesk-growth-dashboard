/** NestJS DI tokens for the Workflow and Task Template Library module — kept in one file, same
 *  pattern as ../brand-library/brand-library.constants.ts. */
export const WORKFLOW_TASK_TEMPLATE_REPOSITORY = Symbol("WORKFLOW_TASK_TEMPLATE_REPOSITORY");

/** The RBAC group key (`06_Roles_and_Permissions.md`, `00013-seed-rbac-matrix.ts:199-207`) —
 *  distinct from `module_registry.key = "workflow_and_task_template_library"`. Declared once here,
 *  not independently in both the service and the controller, so a future RBAC-key rename can't
 *  silently diverge between the two files, mirroring `BRAND_LIBRARY_MODULE_KEY`'s own identical
 *  fix for the same bug class. */
export const WORKFLOW_TASK_TEMPLATE_LIBRARY_MODULE_KEY = "ready_for_claude";
