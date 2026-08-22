import type { PersonaApprovalStatus } from "@webdesk/shared-types";
import type { StatusToken } from "@webdesk/ui";
import {
  ARTIFACT_APPROVAL_STATUS_LABEL,
  ARTIFACT_APPROVAL_STATUS_VALUES,
  artifactApprovalStatusBadge,
} from "./artifact-approval-status";
import { DEFAULT_PAGE_SIZE, parsePageSize, type PageSize } from "./pagination";
import { firstValue } from "./search-params";

/**
 * `PersonaLibraryQuery`/`parsePersonaLibrarySearchParams`/`buildPersonaLibraryHref` live in their
 * own file with zero non-type imports, rather than in `lib/persona-library.ts` where the
 * server-side fetch functions live — so a `"use client"` component (the create/edit form, the
 * status-actions island) can import the real functions directly without pulling in
 * `lib/persona-library.ts`'s `next/headers` import. Same precedent as
 * `lib/service-library-query.ts`/`lib/business-knowledge-query.ts`.
 */

// PersonaApprovalStatus is structurally identical to ArtifactApprovalStatus (Service Library's
// own identical 8-value workflow, reused verbatim per D3) — reused directly rather than
// re-declared here, closing a byte-for-byte duplication a code review caught between the two
// modules' own status-label/badge maps.
const APPROVAL_STATUS_VALUES: readonly PersonaApprovalStatus[] = ARTIFACT_APPROVAL_STATUS_VALUES;

export const APPROVAL_STATUS_LABEL: Readonly<Record<PersonaApprovalStatus, string>> =
  ARTIFACT_APPROVAL_STATUS_LABEL;

export function personaApprovalStatusBadge(status: PersonaApprovalStatus): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return artifactApprovalStatusBadge(status);
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
