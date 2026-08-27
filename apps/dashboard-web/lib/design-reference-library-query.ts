import type { DesignReferenceApprovalStatus } from "@webdesk/shared-types";
import type { StatusToken } from "@webdesk/ui";
import {
  ARTIFACT_APPROVAL_STATUS_LABEL,
  ARTIFACT_APPROVAL_STATUS_VALUES,
  artifactApprovalStatusBadge,
} from "./artifact-approval-status";
import { DEFAULT_PAGE_SIZE, parsePageSize, type PageSize } from "./pagination";
import { firstValue } from "./search-params";

/**
 * `DesignReferenceLibraryQuery`/`parseDesignReferenceLibrarySearchParams`/
 * `buildDesignReferenceLibraryHref` live in their own file with zero non-type imports, rather than
 * in `lib/design-reference-library.ts` where the server-side fetch functions live — so a
 * `"use client"` component (the create/edit form, the status/publish-actions islands) can import
 * the real functions directly without pulling in `lib/design-reference-library.ts`'s `next/headers`
 * import. Same precedent as `lib/brand-library-query.ts`/`lib/content-template-library-query.ts`.
 */

// DesignReferenceApprovalStatus is structurally identical to ArtifactApprovalStatus (the shared
// 8-value workflow every sibling module reuses) — reused directly rather than re-declared here,
// matching every sibling module's own precedent for this shared vocabulary.
const APPROVAL_STATUS_VALUES: readonly DesignReferenceApprovalStatus[] =
  ARTIFACT_APPROVAL_STATUS_VALUES;

export const APPROVAL_STATUS_LABEL: Readonly<Record<DesignReferenceApprovalStatus, string>> =
  ARTIFACT_APPROVAL_STATUS_LABEL;

export function designReferenceApprovalStatusBadge(status: DesignReferenceApprovalStatus): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return artifactApprovalStatusBadge(status);
}

/**
 * `isPublished` badge presentation — same reasoning as `brandLibraryPublishBadge()`/
 * `contentTemplatePublishBadge()`: only 5 `StatusToken` values exist in total and the
 * approval-status badge above already claims all 5, so a collision with SOME approval-status token
 * is unavoidable. `notConfigured` for "Unpublished" avoids colliding with `draft`'s own `unknown`
 * token (the single most common real pairing, since every new record starts both draft and
 * unpublished); `healthy` for "Published" collides with `approved`, the least harmful collision
 * available since publishing requires `approved`, so the two badges reading the same "good" color
 * together at their most common pairing reinforce rather than contradict each other.
 */
export function designReferencePublishBadge(isPublished: boolean): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return isPublished
    ? { token: "healthy", label: "Published" }
    : { token: "notConfigured", label: "Unpublished" };
}

export interface DesignReferenceLibraryQuery {
  readonly approvalStatus: DesignReferenceApprovalStatus | null;
  readonly isPublished: boolean | null;
  readonly search: string | null;
  readonly offset: number;
  readonly pageSize: PageSize;
}

/**
 * Next.js `searchParams` is untrusted client input — validated against the same values
 * `GET /design-reference-library/records` itself accepts
 * (`apps/dashboard-api/src/design-reference-library/design-reference-library.dto.ts`'s
 * `listDesignReferenceRecordsQuerySchema`) rather than passed through raw, so a garbled URL
 * degrades to the default query instead of round-tripping an invalid value to the backend. No
 * `recordType` param — unlike Brand Library, this module has no discriminator. No `sortBy`/
 * `sortOrder` param — the backend's `list()` supports neither.
 */
export function parseDesignReferenceLibrarySearchParams(
  raw: Record<string, string | string[] | undefined>,
): DesignReferenceLibraryQuery {
  const approvalStatus = firstValue(raw.approvalStatus);
  const isPublishedRaw = firstValue(raw.isPublished);
  const search = firstValue(raw.search);
  const offsetRaw = firstValue(raw.offset);
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0;

  return {
    approvalStatus: APPROVAL_STATUS_VALUES.includes(approvalStatus as DesignReferenceApprovalStatus)
      ? (approvalStatus as DesignReferenceApprovalStatus)
      : null,
    isPublished: isPublishedRaw === "true" ? true : isPublishedRaw === "false" ? false : null,
    // Clamped to the same 255-char max the backend's own listDesignReferenceRecordsQuerySchema
    // enforces — matches every sibling list page's own defense-in-depth precedent.
    search: search ? search.slice(0, 255) : null,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    pageSize: parsePageSize(firstValue(raw.pageSize)),
  };
}

/**
 * Builds a `/design-reference-library?...` href — `overrides` wins over `current`, and changing
 * anything other than `offset` itself resets `offset` to 0, same convention as
 * `buildBrandLibraryHref`/`buildContentTemplateLibraryHref`.
 */
export function buildDesignReferenceLibraryHref(
  current: DesignReferenceLibraryQuery,
  overrides: Partial<DesignReferenceLibraryQuery>,
): string {
  const next: DesignReferenceLibraryQuery = {
    ...current,
    ...overrides,
    offset: overrides.offset !== undefined ? overrides.offset : 0,
  };
  const params = new URLSearchParams();
  if (next.approvalStatus) params.set("approvalStatus", next.approvalStatus);
  if (next.isPublished !== null) params.set("isPublished", String(next.isPublished));
  if (next.search) params.set("search", next.search);
  if (next.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(next.pageSize));
  if (next.offset > 0) params.set("offset", String(next.offset));
  const queryString = params.toString();
  return queryString ? `/design-reference-library?${queryString}` : "/design-reference-library";
}

export { APPROVAL_STATUS_VALUES };
