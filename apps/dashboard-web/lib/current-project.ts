/**
 * The shell's "current project" is a lightweight client-side pointer only — which project the
 * header's Project Switcher shows as selected. No downstream module reads it yet; wiring a real
 * session/request-scoped project context for other modules to consume was explicitly flagged as
 * separate, undesigned scope (`docs/task-packages/module-projects-foundation.md` D7) and stays
 * that way here. This cookie exists so the selection survives a reload/new tab, nothing more.
 */
export const CURRENT_PROJECT_COOKIE = "wds_current_project";
