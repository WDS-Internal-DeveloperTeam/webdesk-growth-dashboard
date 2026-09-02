import type { ReadyForClaudeTaskPriority, ReadyForClaudeTaskStatus } from "@webdesk/shared-types";
import type { StatusToken } from "@webdesk/ui";
import { DEFAULT_PAGE_SIZE, parsePageSize, type PageSize } from "./pagination";
import { firstValue } from "./search-params";

/**
 * `ReadyForClaudeQueueQuery`/`parseReadyForClaudeQueueSearchParams`/`buildReadyForClaudeQueueHref`/
 * label and badge maps live in their own file with zero non-type imports, rather than in
 * `lib/ready-for-claude-queue.ts` where the server-side fetch functions live — so a `"use client"`
 * component (`ReadyForClaudeTaskForm`, `ReadyForClaudeTaskStatusActions`) can import the real
 * functions directly without pulling in that file's `next/headers` import. Same precedent as
 * `lib/review-and-approval-center-query.ts`/`lib/website-strategy-center-query.ts`.
 *
 * `moduleDisplayName`/`sortModulesForPicker` are NOT redeclared here — this module reuses Review
 * and Approval Center's own copies directly (both re-exported below), since the two modules share
 * the identical `session.navigation`-backed target-module picker requirement, and this codebase's
 * own standing feedback is to reuse before duplicating.
 */
export { moduleDisplayName, sortModulesForPicker } from "./review-and-approval-center-query";

// Mirrors apps/dashboard-api/src/ready-for-claude-queue/ready-for-claude-queue.dto.ts's
// STATUS_VALUES/PRIORITY_VALUES — kept in sync by hand, same approach every sibling module's own
// `-query.ts` file uses for its own enum.
export const READY_FOR_CLAUDE_TASK_STATUS_VALUES: readonly ReadyForClaudeTaskStatus[] = [
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
];

export const READY_FOR_CLAUDE_TASK_PRIORITY_VALUES: readonly ReadyForClaudeTaskPriority[] = [
  "low",
  "medium",
  "high",
  "critical",
];

export const READY_FOR_CLAUDE_TASK_STATUS_LABEL: Readonly<
  Record<ReadyForClaudeTaskStatus, string>
> = {
  draft: "Draft",
  ready_for_claude: "Ready for Claude",
  claimed: "Claimed",
  in_progress: "In Progress",
  awaiting_review: "Awaiting Review",
  changes_requested: "Changes Requested",
  approved: "Approved",
  completed: "Completed",
  cancelled: "Cancelled",
  paused: "Paused",
  failed: "Failed",
};

export const READY_FOR_CLAUDE_TASK_PRIORITY_LABEL: Readonly<
  Record<ReadyForClaudeTaskPriority, string>
> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

/**
 * The 11-state workflow mapped onto `StatusBadge`'s own 5-token vocabulary
 * (`healthy`/`degraded`/`unavailable`/`notConfigured`/`unknown`) — the same, older
 * `StatusBadge`/`StatusToken` pair `reviewStatusBadge()`/every sibling `*StatusBadge` helper in
 * this app already uses, not the newer `Badge`/`statusBadgeTokens` pair (`lib/modules.ts`), for
 * consistency with this module's own closest sibling (Review and Approval Center). No status
 * name, no meaning is invented — this only assigns each existing value a visual bucket:
 * `draft`/`ready_for_claude`/`claimed`/`awaiting_review` (queued/pending, no active risk) and
 * `completed`/`approved` (successfully concluded) get their own distinct buckets;
 * `in_progress`/`paused`/`changes_requested` (needs attention or active work) share `degraded`;
 * `cancelled`/`failed` (a task that did not conclude successfully) share `unavailable`.
 */
const READY_FOR_CLAUDE_TASK_STATUS_BADGE: Readonly<
  Record<ReadyForClaudeTaskStatus, { token: StatusToken; label: string }>
> = {
  draft: { token: "notConfigured", label: "Draft" },
  ready_for_claude: { token: "notConfigured", label: "Ready for Claude" },
  claimed: { token: "notConfigured", label: "Claimed" },
  in_progress: { token: "degraded", label: "In Progress" },
  awaiting_review: { token: "notConfigured", label: "Awaiting Review" },
  changes_requested: { token: "degraded", label: "Changes Requested" },
  approved: { token: "healthy", label: "Approved" },
  completed: { token: "healthy", label: "Completed" },
  cancelled: { token: "unavailable", label: "Cancelled" },
  paused: { token: "degraded", label: "Paused" },
  failed: { token: "unavailable", label: "Failed" },
};

export function readyForClaudeTaskStatusBadge(status: ReadyForClaudeTaskStatus): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return READY_FOR_CLAUDE_TASK_STATUS_BADGE[status];
}

export interface ReadyForClaudeQueueQuery {
  readonly status: ReadyForClaudeTaskStatus | null;
  readonly priority: ReadyForClaudeTaskPriority | null;
  readonly projectId: string | null;
  readonly targetModuleKey: string | null;
  readonly agent: string | null;
  readonly search: string | null;
  readonly offset: number;
  readonly pageSize: PageSize;
}

/**
 * Next.js `searchParams` is untrusted client input — validated against the same enums
 * `GET /ready-for-claude-queue/tasks` itself accepts
 * (`listReadyForClaudeTasksQuerySchema`) rather than passed through raw, so a garbled URL
 * degrades to the default query instead of round-tripping an invalid value to the backend.
 * `targetModuleKey` has no fixed frontend enum to validate against (unlike `status`/`priority`) —
 * mirrors `parseReviewsSearchParams()`'s own identical clamp-only treatment. `projectId` is
 * clamped to a UUID-only shape isn't enforced here (a malformed value just returns an empty
 * result set from the backend, harmlessly, matching every other id-shaped filter in this app).
 */
export function parseReadyForClaudeQueueSearchParams(
  raw: Record<string, string | string[] | undefined>,
): ReadyForClaudeQueueQuery {
  const status = firstValue(raw.status);
  const priority = firstValue(raw.priority);
  const projectId = firstValue(raw.projectId);
  const targetModuleKey = firstValue(raw.targetModuleKey);
  const agent = firstValue(raw.agent);
  const search = firstValue(raw.search);
  const offsetRaw = firstValue(raw.offset);
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0;

  return {
    status: READY_FOR_CLAUDE_TASK_STATUS_VALUES.includes(status as ReadyForClaudeTaskStatus)
      ? (status as ReadyForClaudeTaskStatus)
      : null,
    priority: READY_FOR_CLAUDE_TASK_PRIORITY_VALUES.includes(priority as ReadyForClaudeTaskPriority)
      ? (priority as ReadyForClaudeTaskPriority)
      : null,
    projectId: projectId ? projectId.slice(0, 64) : null,
    targetModuleKey: targetModuleKey ? targetModuleKey.slice(0, 64) : null,
    agent: agent ? agent.slice(0, 255) : null,
    search: search ? search.slice(0, 255) : null,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    pageSize: parsePageSize(firstValue(raw.pageSize)),
  };
}

/**
 * Builds a `/ready-for-claude-queue?...` href — `overrides` wins over `current`, and changing
 * anything other than `offset`/`pageSize` itself resets `offset` to 0, same convention as
 * `buildReviewsHref`/`buildWebsiteStrategyCenterHref`.
 */
export function buildReadyForClaudeQueueHref(
  current: ReadyForClaudeQueueQuery,
  overrides: Partial<ReadyForClaudeQueueQuery>,
): string {
  const next: ReadyForClaudeQueueQuery = {
    ...current,
    ...overrides,
    offset: overrides.offset !== undefined ? overrides.offset : 0,
  };
  const params = new URLSearchParams();
  if (next.status) params.set("status", next.status);
  if (next.priority) params.set("priority", next.priority);
  if (next.projectId) params.set("projectId", next.projectId);
  if (next.targetModuleKey) params.set("targetModuleKey", next.targetModuleKey);
  if (next.agent) params.set("agent", next.agent);
  if (next.search) params.set("search", next.search);
  if (next.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(next.pageSize));
  if (next.offset > 0) params.set("offset", String(next.offset));
  const queryString = params.toString();
  return queryString ? `/ready-for-claude-queue?${queryString}` : "/ready-for-claude-queue";
}
