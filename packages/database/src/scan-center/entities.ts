/**
 * The Scan Center module foundation (module #31, `docs/implementation/module-scan-center.md`) —
 * persistence-layer shapes for `scan_definitions`, `scan_runs`, `scan_findings`, `scan_evidence`
 * (migration `00103`).
 *
 * Four tables forming a real pipeline: a `ScanDefinition` describes WHAT to scan (and how); a
 * `ScanRun` is one execution of a definition, progressing through a real status lifecycle; a
 * `ScanFinding` is a discrete issue surfaced by a completed/partially-completed run; `ScanEvidence`
 * is immutable supporting material attached to one finding. `project_id` is denormalized onto
 * `scan_runs`/`scan_findings`/`scan_evidence` (not just derived via join) for cheap query/IDOR
 * scoping at every layer, matching this codebase's own established pattern for a multi-table
 * project-scoped pipeline (Ready for Claude Queue's own `dependencies`-style denormalization).
 */

export type ScanType =
  | "full_website"
  | "selected_page"
  | "repository"
  | "wordpress_health"
  | "theme_plugin_core_currency"
  | "security_indicators"
  | "accessibility"
  | "performance"
  | "links"
  | "metadata"
  | "structured_data";

export type ScanMode = "manual" | "scheduled";

/**
 * A saved scan configuration — what to scan, and (optionally) on what schedule. Has no workflow of
 * its own; only `isEnabled` toggles whether it may currently be run. `target` is deliberately plain
 * free text, not URL-validated at either layer — a repository ref or a "selected page" slug is not
 * always a URL.
 */
export interface ScanDefinitionEntity {
  readonly id: string;
  readonly projectId: string;
  readonly publicId: string;
  readonly name: string;
  readonly scanType: ScanType;
  readonly mode: ScanMode;
  readonly target: string | null;
  readonly environment: string | null;
  readonly scheduleCron: string | null;
  readonly isEnabled: boolean;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type ScanRunStatus =
  | "requested"
  | "queued"
  | "running"
  | "completed"
  | "partially_completed"
  | "failed"
  | "timed_out"
  | "cancelled";

export type ScanRunTriggerType = "manual" | "scheduled";

/**
 * One execution of a `ScanDefinition`. `startedAt`/`completedAt` are server-stamped only, by
 * `ScanRunRepository.updateStatus()`'s own atomic conditional write — never accepted as caller
 * input, never overwritten once first set.
 */
export interface ScanRunEntity {
  readonly id: string;
  readonly projectId: string;
  readonly publicId: string;
  readonly scanDefinitionId: string;
  readonly status: ScanRunStatus;
  readonly triggerType: ScanRunTriggerType;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly errorSummary: string | null;
  readonly requestedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type ScanFindingSeverity = "critical" | "high" | "medium" | "low" | "info";

export type ScanFindingStatus = "open" | "acknowledged" | "resolved" | "dismissed";

/**
 * A discrete issue surfaced by a run. `category` is plain free text (no canonical value list
 * exists anywhere in the sources for this field). Created only as a side effect of a run
 * transitioning to `completed`/`partially_completed` with a non-empty `findings` payload — there
 * is no standalone create route for this table.
 */
export interface ScanFindingEntity {
  readonly id: string;
  readonly projectId: string;
  readonly publicId: string;
  readonly scanRunId: string;
  readonly category: string | null;
  readonly severity: ScanFindingSeverity;
  readonly title: string;
  readonly description: string | null;
  readonly location: string | null;
  readonly status: ScanFindingStatus;
  readonly resolvedBy: string | null;
  readonly resolvedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Immutable supporting material attached to one finding — no update/delete route exists for this
 * table (append-only, matching every non-hard-delete precedent in this codebase, ADR-0016).
 * `reference` is validated (when present) via the shared `safeHttpUrlSchema` at the DTO layer, not
 * the database layer.
 */
export interface ScanEvidenceEntity {
  readonly id: string;
  readonly projectId: string;
  readonly publicId: string;
  readonly scanFindingId: string;
  readonly evidenceType: string | null;
  readonly reference: string | null;
  readonly notes: string | null;
  readonly capturedAt: string | null;
  readonly createdBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
