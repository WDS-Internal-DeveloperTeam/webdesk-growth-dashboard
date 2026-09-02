import type {
  TechnicalCheckMode,
  TechnicalCheckRunStatus,
  TechnicalCheckRunTriggerType,
  TechnicalCheckType,
  TechnicalFindingSeverity,
  TechnicalFindingStatus,
} from "@webdesk/shared-types";
import type { StatusToken } from "@webdesk/ui";
import { DEFAULT_PAGE_SIZE, parsePageSize, type PageSize } from "./pagination";
import { firstValue } from "./search-params";

/**
 * `TechnicalCheckDefinitionsQuery`/`parseTechnicalCheckDefinitionsSearchParams`/
 * `buildTechnicalCheckDefinitionsHref`/label and badge maps live in their own file with zero
 * non-type imports, rather than in `lib/technical-center.ts` where the server-side fetch functions
 * live — so a `"use client"` component (the create/edit form, the two status-actions islands) can
 * import the real functions directly without pulling in that file's `next/headers` import. Same
 * precedent as `lib/scan-center-query.ts`/`lib/page-inventory-query.ts`.
 */

// Mirrors apps/dashboard-api/src/technical-center/technical-center.dto.ts's
// TECHNICAL_CHECK_TYPE_VALUES — kept in sync by hand, same approach every sibling module's own
// `-query.ts` file uses for its own enum.
export const TECHNICAL_CHECK_TYPE_VALUES: readonly TechnicalCheckType[] = [
  "coding_standards",
  "linting",
  "automated_tests",
  "coverage",
  "dependency_vulnerability",
  "wordpress_compatibility",
  "php_compatibility",
  "code_review",
  "security",
  "accessibility",
  "performance",
  "browser_compatibility",
  "visual_regression",
];

export const TECHNICAL_CHECK_TYPE_LABEL: Readonly<Record<TechnicalCheckType, string>> = {
  coding_standards: "Coding standards",
  linting: "Linting",
  automated_tests: "Automated tests",
  coverage: "Coverage",
  dependency_vulnerability: "Dependency vulnerability",
  wordpress_compatibility: "WordPress compatibility",
  php_compatibility: "PHP compatibility",
  code_review: "Code review",
  security: "Security",
  accessibility: "Accessibility",
  performance: "Performance",
  browser_compatibility: "Browser compatibility",
  visual_regression: "Visual regression",
};

export const TECHNICAL_CHECK_MODE_VALUES: readonly TechnicalCheckMode[] = ["manual", "scheduled"];
export const TECHNICAL_CHECK_MODE_LABEL: Readonly<Record<TechnicalCheckMode, string>> = {
  manual: "Manual",
  scheduled: "Scheduled",
};

export const TECHNICAL_CHECK_RUN_TRIGGER_TYPE_LABEL: Readonly<
  Record<TechnicalCheckRunTriggerType, string>
> = {
  manual: "Manual",
  scheduled: "Scheduled",
};

// Mirrors TechnicalCheckRunsService's own TRANSITIONS table — kept in sync by hand.
export const TECHNICAL_CHECK_RUN_STATUS_VALUES: readonly TechnicalCheckRunStatus[] = [
  "requested",
  "queued",
  "running",
  "completed",
  "partially_completed",
  "failed",
  "timed_out",
  "cancelled",
];

export const TECHNICAL_CHECK_RUN_STATUS_LABEL: Readonly<Record<TechnicalCheckRunStatus, string>> = {
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
 * (`healthy`/`degraded`/`unavailable`/`notConfigured`/`unknown`), the same bucket assignment
 * `scanRunStatusBadge()` already uses for the byte-identical `ScanRunStatus` workflow: no status
 * name, no meaning is invented — this only assigns each existing value a visual bucket.
 * `requested`/`queued` (pending, no active risk) get `notConfigured`; `running`/
 * `partially_completed` (active work, or a mixed outcome worth a second look) share `degraded`;
 * `completed` (the clean success outcome) gets `healthy`; `failed`/`timed_out`/`cancelled` (did not
 * conclude successfully) share `unavailable`.
 */
const TECHNICAL_CHECK_RUN_STATUS_BADGE: Readonly<
  Record<TechnicalCheckRunStatus, { token: StatusToken; label: string }>
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

export function technicalCheckRunStatusBadge(status: TechnicalCheckRunStatus): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return TECHNICAL_CHECK_RUN_STATUS_BADGE[status];
}

export const TECHNICAL_FINDING_SEVERITY_VALUES: readonly TechnicalFindingSeverity[] = [
  "critical",
  "high",
  "medium",
  "low",
  "info",
];

export const TECHNICAL_FINDING_SEVERITY_LABEL: Readonly<Record<TechnicalFindingSeverity, string>> =
  {
    critical: "Critical",
    high: "High",
    medium: "Medium",
    low: "Low",
    info: "Info",
  };

/** No canonical status-badge vocabulary exists for "how bad is this," so severity is mapped onto
 *  the same 5-token vocabulary purely by rough visual urgency, mirroring `scanFindingSeverityBadge()`'s
 *  own identical bucket assignment: `critical`/`high` -> `unavailable` (the two severities this
 *  app's badge palette should make hardest to miss), `medium` -> `degraded`, `low`/`info` ->
 *  `notConfigured` (present, not urgent). */
const TECHNICAL_FINDING_SEVERITY_BADGE: Readonly<
  Record<TechnicalFindingSeverity, { token: StatusToken; label: string }>
> = {
  critical: { token: "unavailable", label: "Critical" },
  high: { token: "unavailable", label: "High" },
  medium: { token: "degraded", label: "Medium" },
  low: { token: "notConfigured", label: "Low" },
  info: { token: "notConfigured", label: "Info" },
};

export function technicalFindingSeverityBadge(severity: TechnicalFindingSeverity): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return TECHNICAL_FINDING_SEVERITY_BADGE[severity];
}

// Mirrors TechnicalFindingsService's own TRANSITIONS table — kept in sync by hand.
export const TECHNICAL_FINDING_STATUS_VALUES: readonly TechnicalFindingStatus[] = [
  "open",
  "acknowledged",
  "resolved",
  "dismissed",
];

export const TECHNICAL_FINDING_STATUS_LABEL: Readonly<Record<TechnicalFindingStatus, string>> = {
  open: "Open",
  acknowledged: "Acknowledged",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

/** `open` (needs attention) -> `notConfigured`; `acknowledged` (actively being worked) ->
 *  `degraded`; `resolved` (the clean disposition) -> `healthy`; `dismissed` (a deliberate, valid,
 *  but non-fixing disposition) -> `unavailable`, mirroring `scanFindingStatusBadge()`'s own
 *  identical did-not-conclude-with-a-fix bucket for `dismissed`. */
const TECHNICAL_FINDING_STATUS_BADGE: Readonly<
  Record<TechnicalFindingStatus, { token: StatusToken; label: string }>
> = {
  open: { token: "notConfigured", label: "Open" },
  acknowledged: { token: "degraded", label: "Acknowledged" },
  resolved: { token: "healthy", label: "Resolved" },
  dismissed: { token: "unavailable", label: "Dismissed" },
};

export function technicalFindingStatusBadge(status: TechnicalFindingStatus): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return TECHNICAL_FINDING_STATUS_BADGE[status];
}

/**
 * `isEnabled` is a real tri-state — `null` means "all", not "false" — matching
 * `listTechnicalCheckDefinitionsQuerySchema`'s own optional boolean filter.
 */
export interface TechnicalCheckDefinitionsQuery {
  readonly projectId: string;
  readonly checkType: TechnicalCheckType | null;
  readonly isEnabled: boolean | null;
  readonly search: string | null;
  readonly offset: number;
  readonly pageSize: PageSize;
}

/**
 * Next.js `searchParams` is untrusted client input — validated against the same enums/shapes
 * `GET .../definitions` itself accepts (`listTechnicalCheckDefinitionsQuerySchema`) rather than
 * passed through raw, so a garbled URL degrades to the default query instead of round-tripping an
 * invalid value to the backend. `projectId` itself is validated by the caller (a real project
 * lookup), not here — this only parses the FILTER fields, matching
 * `parseScanDefinitionsSearchParams()`'s own split.
 */
export function parseTechnicalCheckDefinitionsSearchParams(
  projectId: string,
  raw: Record<string, string | string[] | undefined>,
): TechnicalCheckDefinitionsQuery {
  const checkType = firstValue(raw.checkType);
  const isEnabledRaw = firstValue(raw.isEnabled);
  const search = firstValue(raw.search);
  const offsetRaw = firstValue(raw.offset);
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0;

  return {
    projectId,
    checkType: TECHNICAL_CHECK_TYPE_VALUES.includes(checkType as TechnicalCheckType)
      ? (checkType as TechnicalCheckType)
      : null,
    isEnabled: isEnabledRaw === "true" ? true : isEnabledRaw === "false" ? false : null,
    // Clamped to the same 255-char max the backend's own listTechnicalCheckDefinitionsQuerySchema
    // enforces — matches every sibling list page's own defense-in-depth precedent.
    search: search ? search.slice(0, 255) : null,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    pageSize: parsePageSize(firstValue(raw.pageSize)),
  };
}

/**
 * Builds a `/technical-center?projectId=...&...` href — `overrides` wins over `current`, and
 * changing anything other than `offset`/`pageSize` itself resets `offset` to 0, same convention as
 * `buildScanDefinitionsHref`/`buildPageInventoryHref`. `projectId` is ALWAYS included first —
 * every link within this module must preserve project context, since every route hard-requires it.
 */
export function buildTechnicalCheckDefinitionsHref(
  current: TechnicalCheckDefinitionsQuery,
  overrides: Partial<TechnicalCheckDefinitionsQuery>,
): string {
  const next: TechnicalCheckDefinitionsQuery = {
    ...current,
    ...overrides,
    offset: overrides.offset !== undefined ? overrides.offset : 0,
  };
  const params = new URLSearchParams();
  params.set("projectId", next.projectId);
  if (next.checkType) params.set("checkType", next.checkType);
  if (next.isEnabled !== null) params.set("isEnabled", String(next.isEnabled));
  if (next.search) params.set("search", next.search);
  if (next.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(next.pageSize));
  if (next.offset > 0) params.set("offset", String(next.offset));
  return `/technical-center?${params.toString()}`;
}

export { withProjectId } from "./project-scoped-href";
