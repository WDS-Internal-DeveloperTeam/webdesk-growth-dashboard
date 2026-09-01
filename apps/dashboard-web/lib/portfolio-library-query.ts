import type { PortfolioApprovalStatus } from "@webdesk/shared-types";
import type { StatusToken } from "@webdesk/ui";
import {
  ARTIFACT_APPROVAL_STATUS_LABEL,
  ARTIFACT_APPROVAL_STATUS_VALUES,
  artifactApprovalStatusBadge,
} from "./artifact-approval-status";
import { DEFAULT_PAGE_SIZE, parsePageSize, type PageSize } from "./pagination";
import { firstValue } from "./search-params";

/**
 * `PortfolioLibraryQuery`/`parsePortfolioLibrarySearchParams`/`buildPortfolioLibraryHref` live in
 * their own file with zero non-type imports, rather than in `lib/portfolio-library.ts` where the
 * server-side fetch functions live — so a `"use client"` component (the create/edit form, the
 * status/publish-actions islands) can import the real functions directly without pulling in
 * `lib/portfolio-library.ts`'s `next/headers` import. Same precedent as
 * `lib/design-reference-library-query.ts`/`lib/content-template-library-query.ts`.
 */

// PortfolioApprovalStatus is structurally identical to ArtifactApprovalStatus (the shared 8-value
// workflow every sibling module reuses) — reused directly rather than re-declared here, matching
// every sibling module's own precedent for this shared vocabulary.
const APPROVAL_STATUS_VALUES: readonly PortfolioApprovalStatus[] = ARTIFACT_APPROVAL_STATUS_VALUES;

export const APPROVAL_STATUS_LABEL: Readonly<Record<PortfolioApprovalStatus, string>> =
  ARTIFACT_APPROVAL_STATUS_LABEL;

export function portfolioApprovalStatusBadge(status: PortfolioApprovalStatus): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return artifactApprovalStatusBadge(status);
}

/**
 * `isPublished` badge presentation — same reasoning as `designReferencePublishBadge()`/
 * `contentTemplatePublishBadge()`: only 5 `StatusToken` values exist in total and the
 * approval-status badge above already claims all 5, so a collision with SOME approval-status token
 * is unavoidable. `notConfigured` for "Unpublished" avoids colliding with `draft`'s own `unknown`
 * token (the single most common real pairing, since every new record starts both draft and
 * unpublished); `healthy` for "Published" collides with `approved`, the least harmful collision
 * available since publishing requires `approved`, so the two badges reading the same "good" color
 * together at their most common pairing reinforce rather than contradict each other.
 */
export function portfolioPublishBadge(isPublished: boolean): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return isPublished
    ? { token: "healthy", label: "Published" }
    : { token: "notConfigured", label: "Unpublished" };
}

export const VISIBILITY_VALUES = [
  "public",
  "internal_only",
  "confidential",
  "client_approval_required",
] as const;

export const VISIBILITY_LABEL: Readonly<Record<(typeof VISIBILITY_VALUES)[number], string>> = {
  public: "Public",
  internal_only: "Internal only",
  confidential: "Confidential",
  client_approval_required: "Client approval required",
};

export interface PortfolioLibraryQuery {
  readonly approvalStatus: PortfolioApprovalStatus | null;
  readonly isPublished: boolean | null;
  readonly search: string | null;
  readonly offset: number;
  readonly pageSize: PageSize;
}

/**
 * Next.js `searchParams` is untrusted client input — validated against the same values
 * `GET /portfolio-library/records` itself accepts
 * (`apps/dashboard-api/src/portfolio-library/portfolio-library.dto.ts`'s
 * `listPortfolioRecordsQuerySchema`) rather than passed through raw, so a garbled URL degrades to
 * the default query instead of round-tripping an invalid value to the backend. No `sortBy`/
 * `sortOrder` param — the backend's `list()` supports neither.
 */
export function parsePortfolioLibrarySearchParams(
  raw: Record<string, string | string[] | undefined>,
): PortfolioLibraryQuery {
  const approvalStatus = firstValue(raw.approvalStatus);
  const isPublishedRaw = firstValue(raw.isPublished);
  const search = firstValue(raw.search);
  const offsetRaw = firstValue(raw.offset);
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0;

  return {
    approvalStatus: APPROVAL_STATUS_VALUES.includes(approvalStatus as PortfolioApprovalStatus)
      ? (approvalStatus as PortfolioApprovalStatus)
      : null,
    isPublished: isPublishedRaw === "true" ? true : isPublishedRaw === "false" ? false : null,
    // Clamped to the same 255-char max the backend's own listPortfolioRecordsQuerySchema
    // enforces — matches every sibling list page's own defense-in-depth precedent.
    search: search ? search.slice(0, 255) : null,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    pageSize: parsePageSize(firstValue(raw.pageSize)),
  };
}

/**
 * Builds a `/portfolio-library?...` href — `overrides` wins over `current`, and changing anything
 * other than `offset` itself resets `offset` to 0, same convention as
 * `buildDesignReferenceLibraryHref`/`buildContentTemplateLibraryHref`.
 */
export function buildPortfolioLibraryHref(
  current: PortfolioLibraryQuery,
  overrides: Partial<PortfolioLibraryQuery>,
): string {
  const next: PortfolioLibraryQuery = {
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
  return queryString ? `/portfolio-library?${queryString}` : "/portfolio-library";
}

export { APPROVAL_STATUS_VALUES };
