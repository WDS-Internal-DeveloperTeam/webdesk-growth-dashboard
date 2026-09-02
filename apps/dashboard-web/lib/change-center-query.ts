import type {
  ChangeRecordCategory,
  ChangeRecordSeverity,
  ChangeRecordStatus,
} from "@webdesk/shared-types";
import type { StatusToken } from "@webdesk/ui";
import { DEFAULT_PAGE_SIZE, parsePageSize, type PageSize } from "./pagination";
import { firstValue } from "./search-params";
import { withProjectId } from "./project-scoped-href";
import { isUuid } from "./uuid";

export { withProjectId };

/**
 * `ChangeCenterQuery`/`parseChangeCenterSearchParams`/`buildChangeCenterHref`/label and badge maps
 * live in their own file with zero non-type imports, rather than in `lib/change-center.ts` where
 * the server-side fetch functions live — so a `"use client"` component (the create/edit form, the
 * status-actions island) can import the real functions directly without pulling in
 * `lib/change-center.ts`'s `next/headers` import. Same precedent as
 * `lib/internal-linking-library-query.ts`/`lib/keyword-and-entity-library-query.ts`.
 *
 * `ChangeRecordStatus` is a genuinely bespoke 10-state workflow (see
 * `apps/dashboard-api/src/change-center/change-records.service.ts`'s own `TRANSITIONS` table), NOT
 * the shared 8-value `ArtifactApprovalStatus` every content-library module reuses, and a
 * DIFFERENT bespoke shape than Internal Linking Library's own 4-state workflow or Ready for
 * Claude Queue's own 11-state workflow — a dedicated label/badge map is declared here rather than
 * force-fit onto an existing one.
 */
export { moduleDisplayName, sortModulesForPicker } from "./review-and-approval-center-query";

// Mirrors apps/dashboard-api/src/change-center/change-center.dto.ts's CATEGORY_VALUES/
// STATUS_VALUES — kept in sync by hand, same approach every sibling module's own `-query.ts` file
// uses for its own enum.
export const CATEGORY_VALUES: readonly ChangeRecordCategory[] = [
  "theme",
  "plugin",
  "core",
  "database",
  "integration",
  "seo_metadata",
  "analytics_tracking",
  "security",
  "accessibility",
  "performance",
  "redirects_urls",
  "assets",
  "conflicts_failed_sync",
  "rollback_history",
];

export const CATEGORY_LABEL: Readonly<Record<ChangeRecordCategory, string>> = {
  theme: "Theme",
  plugin: "Plugin",
  core: "Core",
  database: "Database",
  integration: "Integration",
  seo_metadata: "SEO Metadata",
  analytics_tracking: "Analytics Tracking",
  security: "Security",
  accessibility: "Accessibility",
  performance: "Performance",
  redirects_urls: "Redirects & URLs",
  assets: "Assets",
  conflicts_failed_sync: "Conflicts / Failed Sync",
  rollback_history: "Rollback History",
};

export const SEVERITY_VALUES: readonly ChangeRecordSeverity[] = [
  "critical",
  "high",
  "medium",
  "low",
  "info",
];

export const SEVERITY_LABEL: Readonly<Record<ChangeRecordSeverity, string>> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};

const SEVERITY_BADGE: Readonly<
  Record<ChangeRecordSeverity, { token: StatusToken; label: string }>
> = {
  critical: { token: "unavailable", label: "Critical" },
  high: { token: "degraded", label: "High" },
  medium: { token: "notConfigured", label: "Medium" },
  low: { token: "unknown", label: "Low" },
  info: { token: "unknown", label: "Info" },
};

export function changeRecordSeverityBadge(severity: ChangeRecordSeverity): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return SEVERITY_BADGE[severity];
}

export const STATUS_VALUES: readonly ChangeRecordStatus[] = [
  "detected",
  "under_review",
  "accepted",
  "rejected",
  "deferred",
  "manual_merge_required",
  "applying",
  "applied",
  "verified",
  "apply_failed",
];

export const STATUS_LABEL: Readonly<Record<ChangeRecordStatus, string>> = {
  detected: "Detected",
  under_review: "Under Review",
  accepted: "Accepted",
  rejected: "Rejected",
  deferred: "Deferred",
  manual_merge_required: "Manual Merge Required",
  applying: "Applying",
  applied: "Applied",
  verified: "Verified",
  apply_failed: "Apply Failed",
};

// The 10-state workflow mapped onto StatusBadge's own 5-token vocabulary (healthy/degraded/
// unavailable/notConfigured/unknown), the same older StatusBadge/StatusToken pair every sibling
// *StatusBadge helper in this app already uses. No status name/meaning is invented — this only
// assigns each existing value a visual bucket: detected/under_review/accepted (queued/pending, no
// active risk yet) get notConfigured; deferred/manual_merge_required (needs a human decision) and
// applying (an active in-progress step) share degraded; rejected/apply_failed (did not conclude
// successfully) share unavailable; applied/verified (successfully concluded, the only two
// genuinely "good" end states) share healthy.
const STATUS_BADGE: Readonly<Record<ChangeRecordStatus, { token: StatusToken; label: string }>> = {
  detected: { token: "notConfigured", label: "Detected" },
  under_review: { token: "notConfigured", label: "Under Review" },
  accepted: { token: "notConfigured", label: "Accepted" },
  deferred: { token: "degraded", label: "Deferred" },
  manual_merge_required: { token: "degraded", label: "Manual Merge Required" },
  applying: { token: "degraded", label: "Applying" },
  rejected: { token: "unavailable", label: "Rejected" },
  apply_failed: { token: "unavailable", label: "Apply Failed" },
  applied: { token: "healthy", label: "Applied" },
  verified: { token: "healthy", label: "Verified" },
};

export function changeRecordStatusBadge(status: ChangeRecordStatus): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return STATUS_BADGE[status];
}

/** Mirrors `ChangeRecordsService`'s own `EDITABLE_STATUSES` — a record's content fields may only
 *  be edited while it's still `detected`/`under_review`; the backend rejects any edit attempt on
 *  any other status with a clean 400. Used to hide the detail page's own "Edit" link for a
 *  no-longer-editable record, matching every sibling module's own terminal-state Edit-link-hiding
 *  precedent (Website Strategy Center, Page Inventory). */
export const EDITABLE_STATUSES: ReadonlySet<ChangeRecordStatus> = new Set([
  "detected",
  "under_review",
]);

/**
 * `projectId` is always required and always carried through every built href — change records are
 * project-scoped (`change-center/projects/:projectId/records`), same as Internal Linking Library/
 * Page Inventory/Keyword & Entity Library. Filters mirror the backend's own
 * `listChangeRecordsQuerySchema` (`category`/`severity`/`status`/`scanFindingId`/`assignedToMe`/
 * `search`).
 */
export interface ChangeCenterQuery {
  readonly projectId: string;
  readonly category: ChangeRecordCategory | null;
  readonly severity: ChangeRecordSeverity | null;
  readonly status: ChangeRecordStatus | null;
  readonly scanFindingId: string | null;
  readonly assignedToMe: boolean;
  readonly search: string | null;
  readonly offset: number;
  readonly pageSize: PageSize;
}

/**
 * Next.js `searchParams` is untrusted client input — validated against the same enums/shapes
 * `GET /change-center/projects/:projectId/records` itself accepts rather than passed through raw,
 * so a garbled URL degrades to the default query instead of round-tripping an invalid value to the
 * backend. `projectId` itself is validated by the caller (a UUID check against the real project
 * list), not here — this function only parses the FILTER fields. A malformed `scanFindingId` (not
 * UUID-shaped) is dropped to `null` rather than sent through, matching every other id-shaped
 * filter's "degrade to no filter" precedent in this app.
 */
export function parseChangeCenterSearchParams(
  projectId: string,
  raw: Record<string, string | string[] | undefined>,
): ChangeCenterQuery {
  const category = firstValue(raw.category);
  const severity = firstValue(raw.severity);
  const status = firstValue(raw.status);
  const scanFindingId = firstValue(raw.scanFindingId);
  const assignedToMe = firstValue(raw.assignedToMe);
  const search = firstValue(raw.search);
  const offsetRaw = firstValue(raw.offset);
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0;

  return {
    projectId,
    category: CATEGORY_VALUES.includes(category as ChangeRecordCategory)
      ? (category as ChangeRecordCategory)
      : null,
    severity: SEVERITY_VALUES.includes(severity as ChangeRecordSeverity)
      ? (severity as ChangeRecordSeverity)
      : null,
    status: STATUS_VALUES.includes(status as ChangeRecordStatus)
      ? (status as ChangeRecordStatus)
      : null,
    scanFindingId: scanFindingId && isUuid(scanFindingId) ? scanFindingId : null,
    assignedToMe: assignedToMe === "true",
    // Clamped to the same 255-char max the backend's own listChangeRecordsQuerySchema enforces on
    // this field, matching every sibling list page's own defense-in-depth precedent.
    search: search ? search.slice(0, 255) : null,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    pageSize: parsePageSize(firstValue(raw.pageSize)),
  };
}

/**
 * Builds a `/change-center?projectId=...&...` href — `overrides` wins over `current`, and changing
 * anything other than `offset` itself resets `offset` to 0, same convention as
 * `buildInternalLinkLibraryHref`/`buildKeywordLibraryHref`. `projectId` is ALWAYS included first —
 * every link within this module must preserve project context, since every route hard-requires it.
 */
export function buildChangeCenterHref(
  current: ChangeCenterQuery,
  overrides: Partial<ChangeCenterQuery>,
): string {
  const next: ChangeCenterQuery = {
    ...current,
    ...overrides,
    offset: overrides.offset !== undefined ? overrides.offset : 0,
  };
  const params = new URLSearchParams();
  params.set("projectId", next.projectId);
  if (next.category) params.set("category", next.category);
  if (next.severity) params.set("severity", next.severity);
  if (next.status) params.set("status", next.status);
  if (next.scanFindingId) params.set("scanFindingId", next.scanFindingId);
  if (next.assignedToMe) params.set("assignedToMe", "true");
  if (next.search) params.set("search", next.search);
  if (next.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(next.pageSize));
  if (next.offset > 0) params.set("offset", String(next.offset));
  return `/change-center?${params.toString()}`;
}
