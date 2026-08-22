import type { PersonaApprovalStatus } from "@webdesk/shared-types";
import type { StatusToken } from "@webdesk/ui";
import { DEFAULT_PAGE_SIZE, parsePageSize, type PageSize } from "./pagination";
import { firstValue } from "./search-params";

/**
 * `PersonaLibraryQuery`/`parsePersonaLibrarySearchParams`/`buildPersonaLibraryHref`/the status
 * label+badge maps live in their own file with zero non-type imports, rather than in
 * `lib/persona-library.ts` where the server-side fetch functions live — so a `"use client"`
 * component (the create/edit form, the status-actions island) can import the real functions
 * directly without pulling in `lib/persona-library.ts`'s `next/headers` import. Same precedent as
 * `lib/service-library-query.ts`/`lib/business-knowledge-query.ts`.
 */

// Mirrors packages/database/src/persona-library/entities.ts's PersonaApprovalStatus — reused
// verbatim from Service Library's own identical 8-value workflow (D3).
const APPROVAL_STATUS_VALUES: readonly PersonaApprovalStatus[] = [
  "draft",
  "submitted",
  "under_review",
  "approved",
  "revision_requested",
  "rejected",
  "superseded",
  "archived",
];

export const APPROVAL_STATUS_LABEL: Readonly<Record<PersonaApprovalStatus, string>> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under Review",
  approved: "Approved",
  revision_requested: "Revision Requested",
  rejected: "Rejected",
  superseded: "Superseded",
  archived: "Archived",
};

// Same 8-status-onto-5-token mapping as Service Library's own APPROVAL_STATUS_BADGE (reused
// verbatim, not just structurally mirrored — the two modules share the identical status
// vocabulary) — draft/submitted/approved each get a unique token; under_review/revision_requested
// share `degraded` (both "still in progress"); rejected/superseded/archived share `unavailable`
// (all terminal/no-longer-valid), so no live state collides with a dead one.
const APPROVAL_STATUS_BADGE: Readonly<
  Record<PersonaApprovalStatus, { token: StatusToken; label: string }>
> = {
  draft: { token: "unknown", label: "Draft" },
  submitted: { token: "notConfigured", label: "Submitted" },
  under_review: { token: "degraded", label: "Under Review" },
  approved: { token: "healthy", label: "Approved" },
  revision_requested: { token: "degraded", label: "Revision Requested" },
  rejected: { token: "unavailable", label: "Rejected" },
  superseded: { token: "unavailable", label: "Superseded" },
  archived: { token: "unavailable", label: "Archived" },
};

export function personaApprovalStatusBadge(status: PersonaApprovalStatus): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return APPROVAL_STATUS_BADGE[status];
}

export interface PersonaLibraryQuery {
  readonly approvalStatus: PersonaApprovalStatus | null;
  readonly search: string | null;
  readonly offset: number;
  readonly pageSize: PageSize;
}

/**
 * Next.js `searchParams` is untrusted client input — validated against the same enum
 * `GET /persona-library/personas` itself accepts
 * (`apps/dashboard-api/src/persona-library/persona-library.dto.ts`'s `listPersonasQuerySchema`)
 * rather than passed through raw, so a garbled URL degrades to the default query instead of
 * round-tripping an invalid value to the backend. No `sortBy`/`sortOrder` param — the backend's
 * `list()` supports neither (a fixed `updatedAt DESC, id ASC` order, matching
 * `PersonaRepository.list()`).
 */
export function parsePersonaLibrarySearchParams(
  raw: Record<string, string | string[] | undefined>,
): PersonaLibraryQuery {
  const approvalStatus = firstValue(raw.approvalStatus);
  const search = firstValue(raw.search);
  const offsetRaw = firstValue(raw.offset);
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0;

  return {
    approvalStatus: APPROVAL_STATUS_VALUES.includes(approvalStatus as PersonaApprovalStatus)
      ? (approvalStatus as PersonaApprovalStatus)
      : null,
    // Clamped to the same 255-char max the backend's own listPersonasQuerySchema enforces —
    // matches the Projects/Service Library list pages' own defense-in-depth precedent.
    search: search ? search.slice(0, 255) : null,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    pageSize: parsePageSize(firstValue(raw.pageSize)),
  };
}

/**
 * Builds a `/persona-library?...` href — `overrides` wins over `current`, and changing anything
 * other than `offset` itself resets `offset` to 0, same convention as `buildServiceLibraryHref`.
 */
export function buildPersonaLibraryHref(
  current: PersonaLibraryQuery,
  overrides: Partial<PersonaLibraryQuery>,
): string {
  const next: PersonaLibraryQuery = {
    ...current,
    ...overrides,
    offset: overrides.offset !== undefined ? overrides.offset : 0,
  };
  const params = new URLSearchParams();
  if (next.approvalStatus) params.set("approvalStatus", next.approvalStatus);
  if (next.search) params.set("search", next.search);
  if (next.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(next.pageSize));
  if (next.offset > 0) params.set("offset", String(next.offset));
  const queryString = params.toString();
  return queryString ? `/persona-library?${queryString}` : "/persona-library";
}

export { APPROVAL_STATUS_VALUES };
