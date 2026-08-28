import type { AssetApprovalStatus, AssetScanStatus, AssetVisibility } from "@webdesk/shared-types";
import type { StatusToken } from "@webdesk/ui";
import {
  ARTIFACT_APPROVAL_STATUS_LABEL,
  ARTIFACT_APPROVAL_STATUS_VALUES,
  artifactApprovalStatusBadge,
} from "./artifact-approval-status";
import { DEFAULT_PAGE_SIZE, parsePageSize, type PageSize } from "./pagination";
import { firstValue } from "./search-params";

/**
 * `AssetLibraryQuery`/`parseAssetLibrarySearchParams`/`buildAssetLibraryHref` live in their own
 * file with zero non-type imports, rather than in `lib/asset-library.ts` where the server-side
 * fetch functions live — so a `"use client"` component (`AssetLibraryForm`,
 * `AssetLibraryStatusActions`, `AssetLibraryPublishActions`, `AssetRelatedRecordsSection`) can
 * import the real functions directly without pulling in that file's `next/headers` import. Same
 * precedent as `lib/brand-library-query.ts`/`lib/content-template-library-query.ts`.
 */

// AssetApprovalStatus is structurally identical to ArtifactApprovalStatus (the shared 8-value
// workflow every sibling module reuses, D5) — reused directly rather than re-declared here,
// matching every sibling module's own precedent for this shared vocabulary.
const APPROVAL_STATUS_VALUES: readonly AssetApprovalStatus[] = ARTIFACT_APPROVAL_STATUS_VALUES;

export const APPROVAL_STATUS_LABEL: Readonly<Record<AssetApprovalStatus, string>> =
  ARTIFACT_APPROVAL_STATUS_LABEL;

export function assetApprovalStatusBadge(status: AssetApprovalStatus): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return artifactApprovalStatusBadge(status);
}

/** Same badge-collision reasoning `brandLibraryPublishBadge()`/`contentTemplatePublishBadge()`
 *  already record for themselves — only 5 `StatusToken` values exist and the approval-status badge
 *  above already claims all 5, so a collision is unavoidable. `notConfigured` for "Unpublished"
 *  avoids colliding with `draft`'s own `unknown` token (the most common real pairing); `healthy`
 *  for "Published" collides with `approved`, the least harmful pairing since publishing requires
 *  `approved` (D6). */
export function assetPublishBadge(isPublished: boolean): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return isPublished
    ? { token: "healthy", label: "Published" }
    : { token: "notConfigured", label: "Unpublished" };
}

const VISIBILITY_VALUES: readonly AssetVisibility[] = ["public", "internal", "restricted"];

export const VISIBILITY_LABEL: Readonly<Record<AssetVisibility, string>> = {
  public: "Public",
  internal: "Internal",
  restricted: "Restricted",
};

/** `restricted` gets its own distinct, attention-drawing token — it is the one value that actually
 *  changes what a viewer sees on this record (D2's real redaction). `public`/`internal` are both
 *  ordinary, non-alarming states. */
export function assetVisibilityBadge(visibility: AssetVisibility): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return visibility === "restricted"
    ? { token: "degraded", label: "Restricted" }
    : { token: "unknown", label: VISIBILITY_LABEL[visibility] };
}

const SCAN_STATUS_VALUES: readonly AssetScanStatus[] = [
  "not_configured",
  "pending",
  "clean",
  "infected",
  "failed",
];

export const SCAN_STATUS_LABEL: Readonly<Record<AssetScanStatus, string>> = {
  not_configured: "Scan Not Configured",
  pending: "Scan Pending",
  clean: "Clean",
  infected: "Infected",
  failed: "Scan Failed",
};

/** `infected` is the one value that should visually alarm a reader; `not_configured` (the only
 *  value any code path ever writes today, per D4) deliberately reads as neutral, not degraded —
 *  it is not a problem, it is an honest absence of a capability that doesn't exist yet. */
export function assetScanStatusBadge(scanStatus: AssetScanStatus): {
  readonly token: StatusToken;
  readonly label: string;
} {
  if (scanStatus === "infected" || scanStatus === "failed") {
    return { token: "unavailable", label: SCAN_STATUS_LABEL[scanStatus] };
  }
  if (scanStatus === "pending") {
    return { token: "degraded", label: SCAN_STATUS_LABEL[scanStatus] };
  }
  return { token: "unknown", label: SCAN_STATUS_LABEL[scanStatus] };
}

export interface AssetLibraryQuery {
  readonly approvalStatus: AssetApprovalStatus | null;
  readonly visibility: AssetVisibility | null;
  readonly scanStatus: AssetScanStatus | null;
  readonly isPublished: boolean | null;
  readonly search: string | null;
  readonly offset: number;
  readonly pageSize: PageSize;
}

/**
 * Next.js `searchParams` is untrusted client input — validated against the same values
 * `GET /asset-library/assets` itself accepts
 * (`apps/dashboard-api/src/asset-library/asset-library.dto.ts`'s `listAssetsQuerySchema`) rather
 * than passed through raw, so a garbled URL degrades to the default query instead of round-tripping
 * an invalid value to the backend. No `mimeType`/`sortBy`/`sortOrder` param on the list page's own
 * filter form — the backend's `mimeType` filter exists but this page doesn't surface it, matching
 * every sibling list page's own "renders exactly the filters actually offered" scope.
 */
export function parseAssetLibrarySearchParams(
  raw: Record<string, string | string[] | undefined>,
): AssetLibraryQuery {
  const approvalStatus = firstValue(raw.approvalStatus);
  const visibility = firstValue(raw.visibility);
  const scanStatus = firstValue(raw.scanStatus);
  const isPublishedRaw = firstValue(raw.isPublished);
  const search = firstValue(raw.search);
  const offsetRaw = firstValue(raw.offset);
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0;

  return {
    approvalStatus: APPROVAL_STATUS_VALUES.includes(approvalStatus as AssetApprovalStatus)
      ? (approvalStatus as AssetApprovalStatus)
      : null,
    visibility: VISIBILITY_VALUES.includes(visibility as AssetVisibility)
      ? (visibility as AssetVisibility)
      : null,
    scanStatus: SCAN_STATUS_VALUES.includes(scanStatus as AssetScanStatus)
      ? (scanStatus as AssetScanStatus)
      : null,
    isPublished: isPublishedRaw === "true" ? true : isPublishedRaw === "false" ? false : null,
    // Clamped to the same 255-char max the backend's own listAssetsQuerySchema enforces — matches
    // every sibling list page's own defense-in-depth precedent.
    search: search ? search.slice(0, 255) : null,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    pageSize: parsePageSize(firstValue(raw.pageSize)),
  };
}

/**
 * Builds a `/asset-library?...` href — `overrides` wins over `current`, and changing anything other
 * than `offset` itself resets `offset` to 0, same convention as `buildBrandLibraryHref`/
 * `buildPersonaLibraryHref`.
 */
export function buildAssetLibraryHref(
  current: AssetLibraryQuery,
  overrides: Partial<AssetLibraryQuery>,
): string {
  const next: AssetLibraryQuery = {
    ...current,
    ...overrides,
    offset: overrides.offset !== undefined ? overrides.offset : 0,
  };
  const params = new URLSearchParams();
  if (next.approvalStatus) params.set("approvalStatus", next.approvalStatus);
  if (next.visibility) params.set("visibility", next.visibility);
  if (next.scanStatus) params.set("scanStatus", next.scanStatus);
  if (next.isPublished !== null) params.set("isPublished", String(next.isPublished));
  if (next.search) params.set("search", next.search);
  if (next.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(next.pageSize));
  if (next.offset > 0) params.set("offset", String(next.offset));
  const queryString = params.toString();
  return queryString ? `/asset-library?${queryString}` : "/asset-library";
}

export { APPROVAL_STATUS_VALUES, SCAN_STATUS_VALUES, VISIBILITY_VALUES };
