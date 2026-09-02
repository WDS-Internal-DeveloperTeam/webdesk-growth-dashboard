import type {
  ScanFindingSeverity,
  ScanFindingStatus,
  ScanMode,
  ScanRunStatus,
  ScanRunTriggerType,
  ScanType,
} from "@webdesk/shared-types";
import type { StatusToken } from "@webdesk/ui";
import { DEFAULT_PAGE_SIZE, parsePageSize, type PageSize } from "./pagination";
import { firstValue } from "./search-params";

/**
 * `ScanDefinitionsQuery`/`parseScanDefinitionsSearchParams`/`buildScanDefinitionsHref`/label and
 * badge maps live in their own file with zero non-type imports, rather than in
 * `lib/scan-center.ts` where the server-side fetch functions live — so a `"use client"` component
 * (the create/edit form, the two status-actions islands, the evidence section) can import the real
 * functions directly without pulling in that file's `next/headers` import. Same precedent as
 * `lib/page-inventory-query.ts`/`lib/ready-for-claude-queue-query.ts`.
 */

// Mirrors apps/dashboard-api/src/scan-center/scan-center.dto.ts's SCAN_TYPE_VALUES — kept in sync
// by hand, same approach every sibling module's own `-query.ts` file uses for its own enum.
export const SCAN_TYPE_VALUES: readonly ScanType[] = [
  "full_website",
  "selected_page",
  "repository",
  "wordpress_health",
  "theme_plugin_core_currency",
  "security_indicators",
  "accessibility",
  "performance",
  "links",
  "metadata",
  "structured_data",
];

export const SCAN_TYPE_LABEL: Readonly<Record<ScanType, string>> = {
  full_website: "Full website",
  selected_page: "Selected page",
  repository: "Repository",
  wordpress_health: "WordPress health",
  theme_plugin_core_currency: "Theme/plugin/core currency",
  security_indicators: "Security indicators",
  accessibility: "Accessibility",
  performance: "Performance",
  links: "Links",
  metadata: "Metadata",
  structured_data: "Structured data",
};

export const SCAN_MODE_VALUES: readonly ScanMode[] = ["manual", "scheduled"];
export const SCAN_MODE_LABEL: Readonly<Record<ScanMode, string>> = {
  manual: "Manual",
  scheduled: "Scheduled",
};

export const SCAN_RUN_TRIGGER_TYPE_LABEL: Readonly<Record<ScanRunTriggerType, string>> = {
  manual: "Manual",
  scheduled: "Scheduled",
};

// Mirrors ScanRunsService's own TRANSITIONS table — kept in sync by hand.
export const SCAN_RUN_STATUS_VALUES: readonly ScanRunStatus[] = [
  "requested",
  "queued",
  "running",
  "completed",
  "partially_completed",
  "failed",
  "timed_out",
  "cancelled",
];

export const SCAN_RUN_STATUS_LABEL: Readonly<Record<ScanRunStatus, string>> = {
  requested: "Requested",
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  partially_completed: "Partially Completed",
  failed: "Failed",
  timed_out: "Timed Out",
  cancelled: "Cancelled",
};

/**
 * The 8-state workflow mapped onto `StatusBadge`'s own 5-token vocabulary
 * (`healthy`/`degraded`/`unavailable`/`notConfigured`/`unknown`), the same older `StatusBadge`/
 * `StatusToken` pair every sibling bespoke-workflow module (`InternalLinkStatus`,
 * `ReadyForClaudeTaskStatus`) already uses. No status name, no meaning is invented — this only
 * assigns each existing value a visual bucket: `requested`/`queued` (pending, no active risk) get
 * `notConfigured`; `running`/`partially_completed` (active work, or a mixed outcome worth a second
 * look) share `degraded`; `completed` (the clean success outcome) gets `healthy`; `failed`/
 * `timed_out`/`cancelled` (did not conclude successfully) share `unavailable`.
 */
const SCAN_RUN_STATUS_BADGE: Readonly<
  Record<ScanRunStatus, { token: StatusToken; label: string }>
> = {
  requested: { token: "notConfigured", label: "Requested" },
  queued: { token: "notConfigured", label: "Queued" },
  running: { token: "degraded", label: "Running" },
  completed: { token: "healthy", label: "Completed" },
  partially_completed: { token: "degraded", label: "Partially Completed" },
  failed: { token: "unavailable", label: "Failed" },
  timed_out: { token: "unavailable", label: "Timed Out" },
  cancelled: { token: "unavailable", label: "Cancelled" },
};

export function scanRunStatusBadge(status: ScanRunStatus): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return SCAN_RUN_STATUS_BADGE[status];
}

export const SCAN_FINDING_SEVERITY_VALUES: readonly ScanFindingSeverity[] = [
  "critical",
  "high",
  "medium",
  "low",
  "info",
];

export const SCAN_FINDING_SEVERITY_LABEL: Readonly<Record<ScanFindingSeverity, string>> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};

/** No canonical status-badge vocabulary exists for "how bad is this," so severity is mapped onto
 *  the same 5-token vocabulary purely by rough visual urgency: `critical`/`high` -> `unavailable`
 *  (the two severities this app's badge palette should make hardest to miss), `medium` ->
 *  `degraded`, `low`/`info` -> `notConfigured` (present, not urgent). */
const SCAN_FINDING_SEVERITY_BADGE: Readonly<
  Record<ScanFindingSeverity, { token: StatusToken; label: string }>
> = {
  critical: { token: "unavailable", label: "Critical" },
  high: { token: "unavailable", label: "High" },
  medium: { token: "degraded", label: "Medium" },
  low: { token: "notConfigured", label: "Low" },
  info: { token: "notConfigured", label: "Info" },
};

export function scanFindingSeverityBadge(severity: ScanFindingSeverity): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return SCAN_FINDING_SEVERITY_BADGE[severity];
}

// Mirrors ScanFindingsService's own TRANSITIONS table — kept in sync by hand.
export const SCAN_FINDING_STATUS_VALUES: readonly ScanFindingStatus[] = [
  "open",
  "acknowledged",
  "resolved",
  "dismissed",
];

export const SCAN_FINDING_STATUS_LABEL: Readonly<Record<ScanFindingStatus, string>> = {
  open: "Open",
  acknowledged: "Acknowledged",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

/** `open` (needs attention) -> `notConfigured`; `acknowledged` (actively being worked) ->
 *  `degraded`; `resolved` (the clean disposition) -> `healthy`; `dismissed` (a deliberate, valid,
 *  but non-fixing disposition) -> `unavailable`, mirroring `ScanRunStatus`'s own
 *  did-not-conclude-with-a-fix bucket for `cancelled`. */
const SCAN_FINDING_STATUS_BADGE: Readonly<
  Record<ScanFindingStatus, { token: StatusToken; label: string }>
> = {
  open: { token: "notConfigured", label: "Open" },
  acknowledged: { token: "degraded", label: "Acknowledged" },
  resolved: { token: "healthy", label: "Resolved" },
  dismissed: { token: "unavailable", label: "Dismissed" },
};

export function scanFindingStatusBadge(status: ScanFindingStatus): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return SCAN_FINDING_STATUS_BADGE[status];
}

/**
 * `isEnabled` is a real tri-state — `null` means "all", not "false" — matching
 * `listScanDefinitionsQuerySchema`'s own optional boolean filter.
 */
export interface ScanDefinitionsQuery {
  readonly projectId: string;
  readonly scanType: ScanType | null;
  readonly isEnabled: boolean | null;
  readonly search: string | null;
  readonly offset: number;
  readonly pageSize: PageSize;
}

/**
 * Next.js `searchParams` is untrusted client input — validated against the same enums/shapes
 * `GET .../definitions` itself accepts (`listScanDefinitionsQuerySchema`) rather than passed
 * through raw, so a garbled URL degrades to the default query instead of round-tripping an invalid
 * value to the backend. `projectId` itself is validated by the caller (a real project lookup), not
 * here — this only parses the FILTER fields, matching `parsePageInventorySearchParams()`'s own
 * split.
 */
export function parseScanDefinitionsSearchParams(
  projectId: string,
  raw: Record<string, string | string[] | undefined>,
): ScanDefinitionsQuery {
  const scanType = firstValue(raw.scanType);
  const isEnabledRaw = firstValue(raw.isEnabled);
  const search = firstValue(raw.search);
  const offsetRaw = firstValue(raw.offset);
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0;

  return {
    projectId,
    scanType: SCAN_TYPE_VALUES.includes(scanType as ScanType) ? (scanType as ScanType) : null,
    isEnabled: isEnabledRaw === "true" ? true : isEnabledRaw === "false" ? false : null,
    // Clamped to the same 255-char max the backend's own listScanDefinitionsQuerySchema
    // enforces — matches every sibling list page's own defense-in-depth precedent.
    search: search ? search.slice(0, 255) : null,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    pageSize: parsePageSize(firstValue(raw.pageSize)),
  };
}

/**
 * Builds a `/scan-center?projectId=...&...` href — `overrides` wins over `current`, and changing
 * anything other than `offset`/`pageSize` itself resets `offset` to 0, same convention as
 * `buildPageInventoryHref`/`buildKeywordAndEntityLibraryHref`. `projectId` is ALWAYS included
 * first — every link within this module must preserve project context, since every route
 * hard-requires it.
 */
export function buildScanDefinitionsHref(
  current: ScanDefinitionsQuery,
  overrides: Partial<ScanDefinitionsQuery>,
): string {
  const next: ScanDefinitionsQuery = {
    ...current,
    ...overrides,
    offset: overrides.offset !== undefined ? overrides.offset : 0,
  };
  const params = new URLSearchParams();
  params.set("projectId", next.projectId);
  if (next.scanType) params.set("scanType", next.scanType);
  if (next.isEnabled !== null) params.set("isEnabled", String(next.isEnabled));
  if (next.search) params.set("search", next.search);
  if (next.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(next.pageSize));
  if (next.offset > 0) params.set("offset", String(next.offset));
  return `/scan-center?${params.toString()}`;
}

export { withProjectId } from "./project-scoped-href";
