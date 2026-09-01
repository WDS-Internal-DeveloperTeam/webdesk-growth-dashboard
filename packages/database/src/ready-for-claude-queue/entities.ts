/**
 * The Ready for Claude Queue module foundation (module #30) — persistence-layer shapes for
 * `ready_for_claude_tasks` (migration `00101`).
 * `docs/implementation/module-ready-for-claude-queue.md` records the full account.
 *
 * A single organization-wide table, no sub-resource/join tables — the module's own field list
 * (`03_Detailed_Module_Specifications.md §30`) names no sub-resource, and `dependencies` is an
 * array column rather than a join table for the same reason (D2).
 */

/** Ordinal. `critical` exists (unlike `InternalLinkPriority`'s three values) because an execution
 *  queue genuinely distinguishes "do this next" from "stop everything". */
export type ReadyForClaudeTaskPriority = "low" | "medium" | "high" | "critical";

/**
 * A genuinely bespoke, 11-state workflow (D4) — NOT the 8-value generic `ArtifactApprovalStatus`
 * every content-library module reuses. Sourced from `05_Workflow_State_Machines.md §4`'s own
 * diagram, whose shape (a work-execution pipeline with claim/start/pause/fail branches) the
 * generic content-approval vocabulary has no concept for. The same reasoning that already
 * justified Internal Linking Library's own bespoke 4-state workflow.
 *
 * `completed`, `cancelled`, and `failed` are TERMINAL — no outbound transition exists from any of
 * them, and `ReadyForClaudeTasksService.update()` additionally rejects a plain content edit on a
 * task sitting in one. See that service's own `TRANSITIONS` table for the exact legal edges and
 * the real, seeded RBAC action each one requires.
 */
export type ReadyForClaudeTaskStatus =
  | "draft"
  | "ready_for_claude"
  | "claimed"
  | "in_progress"
  | "awaiting_review"
  | "changes_requested"
  | "approved"
  | "completed"
  | "cancelled"
  | "paused"
  | "failed";

/**
 * The primary (and only) record — one unit of work handed to Claude Code for manual execution
 * (`canonical-inputs/Recommended_Module_Roadmap.md` row 30's "V1 is manual Claude Code execution.
 * No Anthropic API automation").
 *
 * - `targetModuleKey`/`targetId` (D1) are the polymorphic record link Review and Approval Center
 *   already established: the module key is validated against the real module registry at the
 *   service layer, the id is deliberately opaque and unvalidated. Both nullable — a task need not
 *   be about any specific record.
 * - `dependencies` (D2) holds other Ready for Claude task ids, each existence-validated at the
 *   service layer against this same table. Always an array, never `null`.
 * - `agent`/`agentVersion` (D3) are plain, unvalidated text — Agent Directory (#26) and Agent
 *   Specification Library (#27) do not exist yet.
 * - `projectId` (D5) is OPTIONAL, unlike every prior project-scoped module — a task may be
 *   organization-wide. RBAC stays organization-wide regardless.
 * - `prUrl`/`stagingUrl` (D7) are validated with the shared `safeHttpUrlSchema` at the DTO layer.
 * - `status` is server-managed: only `updateStatus()` may change it, never `update()`.
 */
export interface ReadyForClaudeTaskEntity {
  readonly id: string;
  readonly publicId: string;
  readonly title: string;
  readonly description: string | null;
  readonly priority: ReadyForClaudeTaskPriority;
  readonly agent: string | null;
  readonly agentVersion: string | null;
  readonly projectId: string | null;
  readonly targetModuleKey: string | null;
  readonly targetId: string | null;
  readonly status: ReadyForClaudeTaskStatus;
  readonly stage: string | null;
  readonly dependencies: readonly string[];
  readonly operatorUserId: string | null;
  readonly developerUserId: string | null;
  readonly featureBranch: string | null;
  readonly sourceCommit: string | null;
  readonly prId: string | null;
  readonly prUrl: string | null;
  readonly prStatus: string | null;
  readonly reviewerUserId: string | null;
  readonly codeReviewResult: string | null;
  readonly stagingCommit: string | null;
  readonly stagingDeployment: string | null;
  readonly stagingUrl: string | null;
  readonly dashboardReview: string | null;
  readonly changesRequestedNotes: string | null;
  readonly productionApproval: boolean;
  readonly productionApproverUserId: string | null;
  readonly productionCommit: string | null;
  readonly productionDeployment: string | null;
  readonly productionVerification: string | null;
  readonly rollbackVersion: string | null;
  readonly failureReason: string | null;
  readonly retryCount: number;
  readonly dueDate: string | null;
  readonly auditReference: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
