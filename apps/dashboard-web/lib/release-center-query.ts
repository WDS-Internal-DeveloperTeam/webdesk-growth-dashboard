import type { ReleaseStatus, ReleaseType } from "@webdesk/shared-types";
import type { StatusToken } from "@webdesk/ui";
import { DEFAULT_PAGE_SIZE, parsePageSize, type PageSize } from "./pagination";
import { firstValue } from "./search-params";

/**
 * `ReleasesQuery`/`parseReleasesSearchParams`/`buildReleasesHref`/label and badge maps live in
 * their own file with zero non-type imports, rather than in `lib/release-center.ts` where the
 * server-side fetch functions live — so a `"use client"` component (the create/edit form, the
 * status-actions island) can import the real functions directly without pulling in that file's
 * `next/headers` import. Same precedent as `lib/technical-center-query.ts`/`lib/scan-center-query.ts`.
 */

export const RELEASE_TYPE_VALUES: readonly ReleaseType[] = [
  "staging",
  "production",
  "hotfix",
  "rollback",
];

export const RELEASE_TYPE_LABEL: Readonly<Record<ReleaseType, string>> = {
  staging: "Staging",
  production: "Production",
  hotfix: "Hotfix",
  rollback: "Rollback",
};

// Mirrors apps/dashboard-api/src/release-center/release-center.dto.ts's RELEASE_STATUS_VALUES —
// kept in sync by hand, same approach every sibling module's own `-query.ts` file uses.
export const RELEASE_STATUS_VALUES: readonly ReleaseStatus[] = [
  "proposed",
  "checks_running",
  "checks_failed",
  "ready_for_staging",
  "staging_deployed",
  "staging_verification",
  "verification_failed",
  "staging_approved",
  "production_approval",
  "production_deployed",
  "production_verification",
  "completed",
  "hotfix_required",
  "rolled_back",
];

export const RELEASE_STATUS_LABEL: Readonly<Record<ReleaseStatus, string>> = {
  proposed: "Proposed",
  checks_running: "Checks Running",
  checks_failed: "Checks Failed",
  ready_for_staging: "Ready for Staging",
  staging_deployed: "Staging Deployed",
  staging_verification: "Staging Verification",
  verification_failed: "Verification Failed",
  staging_approved: "Staging Approved",
  production_approval: "Production Approval",
  production_deployed: "Production Deployed",
  production_verification: "Production Verification",
  completed: "Completed",
  hotfix_required: "Hotfix Required",
  rolled_back: "Rolled Back",
};

/**
 * The 14-state workflow mapped onto `StatusBadge`'s own 5-token vocabulary
 * (`healthy`/`degraded`/`unavailable`/`notConfigured`/`unknown`) — no status name, no meaning is
 * invented, this only assigns each existing value a visual bucket. `proposed` (not yet started)
 * gets `notConfigured`; every "in progress"/"awaiting a decision" state
 * (`checks_running`/`ready_for_staging`/`staging_deployed`/`staging_verification`/
 * `staging_approved`/`production_approval`/`production_deployed`/`production_verification`) gets
 * `degraded`, since none of them is a clean success or a clean failure yet; `completed` (the
 * single clean success outcome) gets `healthy`; `checks_failed`/`verification_failed`/
 * `hotfix_required`/`rolled_back` (did not conclude cleanly, or needed to be reversed) share
 * `unavailable`.
 */
const RELEASE_STATUS_BADGE: Readonly<Record<ReleaseStatus, { token: StatusToken; label: string }>> =
  {
    proposed: { token: "notConfigured", label: "Proposed" },
    checks_running: { token: "degraded", label: "Checks Running" },
    checks_failed: { token: "unavailable", label: "Checks Failed" },
    ready_for_staging: { token: "degraded", label: "Ready for Staging" },
    staging_deployed: { token: "degraded", label: "Staging Deployed" },
    staging_verification: { token: "degraded", label: "Staging Verification" },
    verification_failed: { token: "unavailable", label: "Verification Failed" },
    staging_approved: { token: "degraded", label: "Staging Approved" },
    production_approval: { token: "degraded", label: "Production Approval" },
    production_deployed: { token: "degraded", label: "Production Deployed" },
    production_verification: { token: "degraded", label: "Production Verification" },
    completed: { token: "healthy", label: "Completed" },
    hotfix_required: { token: "unavailable", label: "Hotfix Required" },
    rolled_back: { token: "unavailable", label: "Rolled Back" },
  };

export function releaseStatusBadge(status: ReleaseStatus): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return RELEASE_STATUS_BADGE[status];
}

export interface ReleasesQuery {
  readonly projectId: string;
  readonly releaseType: ReleaseType | null;
  readonly status: ReleaseStatus | null;
  readonly search: string | null;
  readonly offset: number;
  readonly pageSize: PageSize;
}

/**
 * Next.js `searchParams` is untrusted client input — validated against the same enums/shapes
 * `GET .../releases` itself accepts (`listReleasesQuerySchema`) rather than passed through raw, so
 * a garbled URL degrades to the default query instead of round-tripping an invalid value to the
 * backend. `projectId` itself is validated by the caller (a real project lookup), not here — this
 * only parses the FILTER fields, matching `parseTechnicalCheckDefinitionsSearchParams()`'s own
 * split.
 */
export function parseReleasesSearchParams(
  projectId: string,
  raw: Record<string, string | string[] | undefined>,
): ReleasesQuery {
  const releaseType = firstValue(raw.releaseType);
  const status = firstValue(raw.status);
  const search = firstValue(raw.search);
  const offsetRaw = firstValue(raw.offset);
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0;

  return {
    projectId,
    releaseType: RELEASE_TYPE_VALUES.includes(releaseType as ReleaseType)
      ? (releaseType as ReleaseType)
      : null,
    status: RELEASE_STATUS_VALUES.includes(status as ReleaseStatus)
      ? (status as ReleaseStatus)
      : null,
    // Clamped to the same 255-char max the backend's own listReleasesQuerySchema enforces —
    // matches every sibling list page's own defense-in-depth precedent.
    search: search ? search.slice(0, 255) : null,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    pageSize: parsePageSize(firstValue(raw.pageSize)),
  };
}

/**
 * Builds a `/release-center?projectId=...&...` href — `overrides` wins over `current`, and
 * changing anything other than `offset`/`pageSize` itself resets `offset` to 0, same convention as
 * `buildTechnicalCheckDefinitionsHref`/`buildScanDefinitionsHref`. `projectId` is ALWAYS included
 * first — every link within this module must preserve project context, since every route hard-
 * requires it.
 */
export function buildReleasesHref(
  current: ReleasesQuery,
  overrides: Partial<ReleasesQuery>,
): string {
  const next: ReleasesQuery = {
    ...current,
    ...overrides,
    offset: overrides.offset !== undefined ? overrides.offset : 0,
  };
  const params = new URLSearchParams();
  params.set("projectId", next.projectId);
  if (next.releaseType) params.set("releaseType", next.releaseType);
  if (next.status) params.set("status", next.status);
  if (next.search) params.set("search", next.search);
  if (next.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(next.pageSize));
  if (next.offset > 0) params.set("offset", String(next.offset));
  return `/release-center?${params.toString()}`;
}

export { withProjectId } from "./project-scoped-href";
