import { safeHttpUrlSchema } from "@webdesk/validation";
import { z } from "zod";

// Mirrors packages/database/src/ready-for-claude-queue/entities.ts's ReadyForClaudeTaskStatus — a
// genuinely bespoke 11-state workflow (D4), NOT the 8-value generic artifact lifecycle every
// content-library module reuses.
const STATUS_VALUES = [
  "draft",
  "ready_for_claude",
  "claimed",
  "in_progress",
  "awaiting_review",
  "changes_requested",
  "approved",
  "completed",
  "cancelled",
  "paused",
  "failed",
] as const;
export const readyForClaudeTaskStatusSchema = z.enum(STATUS_VALUES);

const PRIORITY_VALUES = ["low", "medium", "high", "critical"] as const;
export const readyForClaudeTaskPrioritySchema = z.enum(PRIORITY_VALUES);

// Each of these matches the REAL column width in migration 00101 — deliberately not one shared
// "short text" cap, since a DTO limit looser than its own column silently turns a valid-looking
// request into an unhandled 500 at INSERT time (the exact bug Keyword & Entity Library's own code
// review found: a `.max(255)` DTO over a VARCHAR(100) column).
const titleField = z.string().min(1).max(500);
const varchar100Field = z.string().max(100).nullish();
const varchar255Field = z.string().max(255).nullish();
// TEXT columns. Plain, unsanitized text for this backend-only pass (D8) — no RichTextEditor
// wiring is needed until a dashboard-web UI exists to author them, matching Website Strategy
// Center's/Service Library's own original backend-only builds. Capped so an unbounded body can
// never reach storage.
const longTextField = z.string().max(20_000).nullish();

// D2 — other Ready for Claude task ids, each existence-validated against this same table at the
// service layer. Capped at 50: a task with more than 50 blocking dependencies is a modelling
// problem, and the cap bounds the existence-check fan-out.
const dependenciesField = z.array(z.string().uuid()).max(50).nullish();

// --- ready_for_claude_tasks ---

export const listReadyForClaudeTasksQuerySchema = z.object({
  status: readyForClaudeTaskStatusSchema.optional(),
  priority: readyForClaudeTaskPrioritySchema.optional(),
  // Optional (D5) — a filter, not a mandatory route-derived scope, unlike every prior
  // project-scoped module. RBAC for this module is organization-wide.
  projectId: z.string().uuid().optional(),
  targetModuleKey: z.string().min(1).max(64).optional(),
  agent: z.string().max(255).optional(),
  search: z.string().max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListReadyForClaudeTasksQueryDto = z.infer<typeof listReadyForClaudeTasksQuerySchema>;

/** `status` is never accepted — a task always starts `draft`, and only the dedicated
 *  status-transition route may change it thereafter. `productionApproval`/
 *  `productionApproverUserId` are ALSO never accepted here, for the same reason (code-review
 *  finding) — both are server-managed, stamped only by `ReadyForClaudeTasksService.changeStatus()`
 *  when the `approve`-gated `approved -> completed` transition actually happens. Originally these
 *  were plain content fields writable through this route and the generic `edit`-gated `update()`
 *  below, letting any of the four mid-tier roles (who hold `edit` but never `approve`) fabricate a
 *  production sign-off with zero involvement of the real, RBAC-gated `TRANSITIONS` table — a
 *  genuine separation-of-duties bypass this fix closes at the schema layer, not just the service. */
export const createReadyForClaudeTaskSchema = z.object({
  publicId: z.string().min(1).max(64),
  title: titleField,
  description: longTextField,
  priority: readyForClaudeTaskPrioritySchema.optional(),
  // D3 — plain, unvalidated text: neither Agent Directory (#26) nor Agent Specification Library
  // (#27) exists yet to validate against.
  agent: varchar255Field,
  agentVersion: varchar100Field,
  // D5 — optional; existence-validated at the service layer when provided.
  projectId: z.string().uuid().nullish(),
  // D1 — validated against the real module registry at the service layer via
  // `AuthorizationService.isValidModuleKey()`. `.min(1)` closes a code-review finding: without it,
  // an empty string is falsy and silently skips that service-layer check entirely.
  targetModuleKey: z.string().min(1).max(64).nullish(),
  // D1 — deliberately opaque and UNVALIDATED beyond its UUID shape: no generic cross-module
  // record-existence lookup exists anywhere in this codebase.
  targetId: z.string().uuid().nullish(),
  stage: varchar255Field,
  dependencies: dependenciesField,
  operatorUserId: z.string().uuid().nullish(),
  developerUserId: z.string().uuid().nullish(),
  featureBranch: varchar255Field,
  sourceCommit: varchar100Field,
  prId: varchar100Field,
  // D7 — the shared safeHttpUrlSchema, so only http:/https: ever reaches storage (closing the
  // stored-XSS class this codebase already fixed once for Projects' environment.url).
  prUrl: safeHttpUrlSchema.nullish(),
  prStatus: varchar100Field,
  reviewerUserId: z.string().uuid().nullish(),
  codeReviewResult: varchar100Field,
  stagingCommit: varchar100Field,
  stagingDeployment: varchar255Field,
  stagingUrl: safeHttpUrlSchema.nullish(),
  dashboardReview: longTextField,
  changesRequestedNotes: longTextField,
  productionCommit: varchar100Field,
  productionDeployment: varchar255Field,
  productionVerification: longTextField,
  rollbackVersion: varchar100Field,
  failureReason: longTextField,
  retryCount: z.number().int().min(0).optional(),
  dueDate: z.string().datetime().nullish(),
  auditReference: varchar255Field,
});
export type CreateReadyForClaudeTaskDto = z.infer<typeof createReadyForClaudeTaskSchema>;

/** Derived from `createReadyForClaudeTaskSchema` via `.omit().partial()` (code-review finding —
 *  the two schemas were previously hand-duplicated field-by-field, a real drift risk: a validator
 *  change on create, e.g. a length cap, silently wouldn't propagate to update). `publicId`/
 *  `projectId` are omitted — both immutable after creation (a task never moves between projects,
 *  and its own identity never changes), mirroring `updateInternalLinkSchema`'s own identical
 *  exclusion. `status`/`productionApproval`/`productionApproverUserId` are likewise never
 *  accepted — see `createReadyForClaudeTaskSchema`'s own doc comment. */
export const updateReadyForClaudeTaskSchema = createReadyForClaudeTaskSchema
  .omit({ publicId: true, projectId: true })
  .partial()
  // Rejects a genuinely empty patch (`{}`) with a clean 400 instead of silently succeeding as a
  // no-op that still writes an essentially-empty audit event, mirroring every sibling module's own
  // identical fix.
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateReadyForClaudeTaskDto = z.infer<typeof updateReadyForClaudeTaskSchema>;

/** `expectedStatus` is required (unlike `changeInternalLinkStatusSchema`, which derives it from a
 *  fresh read) — it is threaded straight into the repository's atomic compare-and-swap, so a
 *  caller acting on a stale view of the task gets a clean 409 instead of silently overwriting a
 *  transition someone else already made. Mirrors `decideReviewSchema`'s own `expectedStatus`
 *  contract. */
export const changeReadyForClaudeTaskStatusSchema = z.object({
  status: readyForClaudeTaskStatusSchema,
  expectedStatus: readyForClaudeTaskStatusSchema,
});
export type ChangeReadyForClaudeTaskStatusDto = z.infer<
  typeof changeReadyForClaudeTaskStatusSchema
>;
