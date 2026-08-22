import type {
  ServiceApprovalStatus,
  ServiceConfidentiality,
  ServicePublicationStatus,
} from "@webdesk/shared-types";
import type { StatusToken } from "@webdesk/ui";
import {
  ARTIFACT_APPROVAL_STATUS_LABEL,
  ARTIFACT_APPROVAL_STATUS_VALUES,
  artifactApprovalStatusBadge,
} from "./artifact-approval-status";
import { DEFAULT_PAGE_SIZE, parsePageSize, type PageSize } from "./pagination";
import { firstValue } from "./search-params";

/**
 * `ServiceLibraryQuery`/`parseServiceLibrarySearchParams`/`buildServiceLibraryHref`/the status
 * label+badge maps live in their own file with zero non-type imports, rather than in
 * `lib/service-library.ts` where the server-side fetch functions live — so a `"use client"`
 * component (the create/edit form, the status-actions island) can import the real functions
 * directly without pulling in `lib/service-library.ts`'s `next/headers` import. Same precedent as
 * `lib/business-knowledge-query.ts`/`lib/projects-query.ts`.
 */

// ServiceApprovalStatus is structurally identical to ArtifactApprovalStatus (shared with Persona
// Library, which reuses this exact 8-value workflow verbatim per D3) — reused directly rather than
// re-declared here, closing a byte-for-byte duplication a code review caught between the two
// modules' own status-label/badge maps.
const APPROVAL_STATUS_VALUES: readonly ServiceApprovalStatus[] = ARTIFACT_APPROVAL_STATUS_VALUES;

const PUBLICATION_STATUS_VALUES: readonly ServicePublicationStatus[] = [
  "draft",
  "published",
  "unpublished",
];

const CONFIDENTIALITY_VALUES: readonly ServiceConfidentiality[] = [
  "public",
  "internal",
  "restricted",
];

export const APPROVAL_STATUS_LABEL: Readonly<Record<ServiceApprovalStatus, string>> =
  ARTIFACT_APPROVAL_STATUS_LABEL;

export const PUBLICATION_STATUS_LABEL: Readonly<Record<ServicePublicationStatus, string>> = {
  draft: "Draft",
  published: "Published",
  unpublished: "Unpublished",
};

export const CONFIDENTIALITY_LABEL: Readonly<Record<ServiceConfidentiality, string>> = {
  public: "Public",
  internal: "Internal",
  restricted: "Restricted",
};

export function serviceApprovalStatusBadge(status: ServiceApprovalStatus): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return artifactApprovalStatusBadge(status);
}

const PUBLICATION_STATUS_BADGE: Readonly<
  Record<ServicePublicationStatus, { token: StatusToken; label: string }>
> = {
  draft: { token: "unknown", label: "Draft" },
  published: { token: "healthy", label: "Published" },
  unpublished: { token: "notConfigured", label: "Unpublished" },
};

export function servicePublicationStatusBadge(status: ServicePublicationStatus): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return PUBLICATION_STATUS_BADGE[status];
}

export interface ServiceLibraryQuery {
  readonly categoryId: string | null;
  readonly approvalStatus: ServiceApprovalStatus | null;
  readonly publicationStatus: ServicePublicationStatus | null;
  readonly search: string | null;
  readonly offset: number;
  readonly pageSize: PageSize;
}

/**
 * Next.js `searchParams` is untrusted client input — every field is validated against the same
 * enums `GET /service-library/services` itself accepts
 * (`apps/dashboard-api/src/service-library/service-library.dto.ts`'s `listServicesQuerySchema`)
 * rather than passed through raw, so a garbled URL degrades to the default query instead of
 * round-tripping an invalid value to the backend. There is no `sortBy`/`sortOrder` param — the
 * backend's `list()` supports neither (a fixed `updatedAt DESC` order, matching `ServiceRepository.list()`).
 */
export function parseServiceLibrarySearchParams(
  raw: Record<string, string | string[] | undefined>,
): ServiceLibraryQuery {
  const categoryId = firstValue(raw.categoryId);
  const approvalStatus = firstValue(raw.approvalStatus);
  const publicationStatus = firstValue(raw.publicationStatus);
  const search = firstValue(raw.search);
  const offsetRaw = firstValue(raw.offset);
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0;

  return {
    categoryId: categoryId ? categoryId : null,
    approvalStatus: APPROVAL_STATUS_VALUES.includes(approvalStatus as ServiceApprovalStatus)
      ? (approvalStatus as ServiceApprovalStatus)
      : null,
    publicationStatus: PUBLICATION_STATUS_VALUES.includes(
      publicationStatus as ServicePublicationStatus,
    )
      ? (publicationStatus as ServicePublicationStatus)
      : null,
    // Clamped to the same 255-char max the backend's own listServicesQuerySchema enforces —
    // matches the Projects list page's own defense-in-depth precedent.
    search: search ? search.slice(0, 255) : null,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    pageSize: parsePageSize(firstValue(raw.pageSize)),
  };
}

/**
 * Builds a `/service-library?...` href — `overrides` wins over `current`, and changing anything
 * other than `offset` itself resets `offset` to 0, same convention as `buildBusinessKnowledgeHref`.
 */
export function buildServiceLibraryHref(
  current: ServiceLibraryQuery,
  overrides: Partial<ServiceLibraryQuery>,
): string {
  const next: ServiceLibraryQuery = {
    ...current,
    ...overrides,
    offset: overrides.offset !== undefined ? overrides.offset : 0,
  };
  const params = new URLSearchParams();
  if (next.categoryId) params.set("categoryId", next.categoryId);
  if (next.approvalStatus) params.set("approvalStatus", next.approvalStatus);
  if (next.publicationStatus) params.set("publicationStatus", next.publicationStatus);
  if (next.search) params.set("search", next.search);
  if (next.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(next.pageSize));
  if (next.offset > 0) params.set("offset", String(next.offset));
  const queryString = params.toString();
  return queryString ? `/service-library?${queryString}` : "/service-library";
}

export { APPROVAL_STATUS_VALUES, CONFIDENTIALITY_VALUES, PUBLICATION_STATUS_VALUES };
