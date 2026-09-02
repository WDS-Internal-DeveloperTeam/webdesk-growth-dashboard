/**
 * The Technical Center module foundation (module `technical_center`,
 * `docs/implementation/module-technical-center.md`) — persistence-layer shapes for
 * `technical_check_definitions`, `technical_check_runs`, `technical_findings` (migration `00109`).
 *
 * Mirrors Scan Center's own three-level pipeline shape (`packages/database/src/scan-center/`)
 * almost exactly: a `TechnicalCheckDefinition` describes WHAT to check (and how); a
 * `TechnicalCheckRun` is one execution of a definition, progressing through the identical real
 * status lifecycle Scan Center's own `ScanRunStatus` uses; a `TechnicalFinding` is a discrete issue
 * surfaced by a completed/partially-completed run. `project_id` is denormalized onto
 * `technical_check_runs`/`technical_findings` (not just derived via join) for cheap query/IDOR
 * scoping at every layer, matching Scan Center's own established pattern for a multi-table
 * project-scoped pipeline. No `technical_evidence` table — no genuine "supporting artifact" need
 * was identified for this module's own findings (unlike Scan Center's screenshot/log-style
 * evidence), so that fourth table was deliberately not mirrored.
 */

export type TechnicalCheckType =
  | "coding_standards"
  | "linting"
  | "automated_tests"
  | "coverage"
  | "dependency_vulnerability"
  | "wordpress_compatibility"
  | "php_compatibility"
  | "code_review"
  | "security"
  | "accessibility"
  | "performance"
  | "browser_compatibility"
  | "visual_regression";

export type TechnicalCheckMode = "manual" | "scheduled";

/**
 * A saved check configuration — what to check, and (optionally) on what schedule. Has no workflow
 * of its own; only `isEnabled` toggles whether it may currently be run. `target` is deliberately
 * plain free text, not URL-validated at either layer — a repository ref, a package name, or a
 * "selected page" slug is not always a URL.
 */
export interface TechnicalCheckDefinitionEntity {
  readonly id: string;
  readonly projectId: string;
  readonly publicId: string;
  readonly name: string;
  readonly checkType: TechnicalCheckType;
  readonly mode: TechnicalCheckMode;
  readonly target: string | null;
  readonly environment: string | null;
  readonly scheduleCron: string | null;
  readonly isEnabled: boolean;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type TechnicalCheckRunStatus =
  | "requested"
  | "queued"
  | "running"
  | "completed"
  | "partially_completed"
  | "failed"
  | "timed_out"
  | "cancelled";

export type TechnicalCheckRunTriggerType = "manual" | "scheduled";

/**
 * One execution of a `TechnicalCheckDefinition`. `startedAt`/`completedAt` are server-stamped
 * only, by `TechnicalCheckRunRepository.updateStatus()`'s own atomic conditional write — never
 * accepted as caller input, never overwritten once first set. Mirrors `ScanRunEntity` exactly.
 */
export interface TechnicalCheckRunEntity {
  readonly id: string;
  readonly projectId: string;
  readonly publicId: string;
  readonly technicalCheckDefinitionId: string;
  readonly status: TechnicalCheckRunStatus;
  readonly triggerType: TechnicalCheckRunTriggerType;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly errorSummary: string | null;
  readonly requestedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type TechnicalFindingSeverity = "critical" | "high" | "medium" | "low" | "info";

export type TechnicalFindingStatus = "open" | "acknowledged" | "resolved" | "dismissed";

/**
 * A discrete issue surfaced by a run. `category` is plain free text (no canonical value list is
 * sourced anywhere for this field — `checkType` on the parent definition already carries the real
 * taxonomy). Created only as a side effect of a run transitioning to `completed`/
 * `partially_completed` with a non-empty `findings` payload — there is no standalone create route
 * for this table, mirroring `ScanFindingEntity` exactly.
 */
export interface TechnicalFindingEntity {
  readonly id: string;
  readonly projectId: string;
  readonly publicId: string;
  readonly technicalCheckRunId: string;
  readonly category: string | null;
  readonly severity: TechnicalFindingSeverity;
  readonly title: string;
  readonly description: string | null;
  readonly location: string | null;
  readonly status: TechnicalFindingStatus;
  readonly resolvedBy: string | null;
  readonly resolvedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
