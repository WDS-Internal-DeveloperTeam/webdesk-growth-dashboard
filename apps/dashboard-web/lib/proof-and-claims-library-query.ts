import type { ProofClaimApprovalStatus, ProofClaimVerificationStatus } from "@webdesk/shared-types";
import type { StatusToken } from "@webdesk/ui";
import {
  ARTIFACT_APPROVAL_STATUS_LABEL,
  ARTIFACT_APPROVAL_STATUS_VALUES,
  artifactApprovalStatusBadge,
} from "./artifact-approval-status";
import { DEFAULT_PAGE_SIZE, parsePageSize, type PageSize } from "./pagination";
import { firstValue } from "./search-params";

/**
 * `ProofAndClaimsLibraryQuery`/`parseProofAndClaimsLibrarySearchParams`/
 * `buildProofAndClaimsLibraryHref` live in their own file with zero non-type imports, rather than
 * in `lib/proof-and-claims-library.ts` where the server-side fetch functions live — so a
 * `"use client"` component (the create/edit form, the status-actions island, the sources
 * sub-resource section) can import the real functions directly without pulling in
 * `lib/proof-and-claims-library.ts`'s `next/headers` import. Same precedent as
 * `lib/persona-library-query.ts`/`lib/service-library-query.ts`.
 */

// ProofClaimApprovalStatus is structurally identical to ArtifactApprovalStatus (the same 8-value
// artifact-approval workflow Service Library/Persona Library already share, D3) — reused directly
// rather than re-declared here, matching `lib/persona-library-query.ts`'s own precedent for
// closing this exact duplication shape.
const APPROVAL_STATUS_VALUES: readonly ProofClaimApprovalStatus[] = ARTIFACT_APPROVAL_STATUS_VALUES;

export const APPROVAL_STATUS_LABEL: Readonly<Record<ProofClaimApprovalStatus, string>> =
  ARTIFACT_APPROVAL_STATUS_LABEL;

export function proofClaimApprovalStatusBadge(status: ProofClaimApprovalStatus): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return artifactApprovalStatusBadge(status);
}

// Previously hand-typed independently in the list page, detail page, and create/edit form (code
// review finding — 2 finder angles independently converged on this) — the detail page's own copy
// was even more weakly typed (`Record<string, string>`, losing the compiler's exhaustiveness
// check), matching the exact "duplication/reuse miss" pattern this project's own standing
// 2026-08-22 feedback names. `verificationStatus` has no cross-module precedent to reuse (unlike
// `approvalStatus`, shared verbatim with Service Library/Persona Library via
// `artifact-approval-status.ts`), so this lives directly in this module's own query file.
export const VERIFICATION_STATUS_VALUES: readonly ProofClaimVerificationStatus[] = [
  "unverified",
  "pending",
  "verified",
];

export const VERIFICATION_STATUS_LABEL: Readonly<Record<ProofClaimVerificationStatus, string>> = {
  unverified: "Unverified",
  pending: "Pending",
  verified: "Verified",
};

export interface ProofAndClaimsLibraryQuery {
  readonly approvalStatus: ProofClaimApprovalStatus | null;
  readonly search: string | null;
  readonly offset: number;
  readonly pageSize: PageSize;
}

/**
 * Next.js `searchParams` is untrusted client input — validated against the same enum
 * `GET /proof-and-claims-library/claims` itself accepts
 * (`apps/dashboard-api/src/proof-and-claims-library/proof-and-claims-library.dto.ts`'s
 * `listProofClaimsQuerySchema`) rather than passed through raw, so a garbled URL degrades to the
 * default query instead of round-tripping an invalid value to the backend. No `sortBy`/
 * `sortOrder`/`verificationStatus` param — the backend's `list()` supports neither a sort override
 * nor a verification-status filter (a fixed `updatedAt DESC, id ASC` order, matching
 * `ProofClaimRepository.list()`).
 */
export function parseProofAndClaimsLibrarySearchParams(
  raw: Record<string, string | string[] | undefined>,
): ProofAndClaimsLibraryQuery {
  const approvalStatus = firstValue(raw.approvalStatus);
  const search = firstValue(raw.search);
  const offsetRaw = firstValue(raw.offset);
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0;

  return {
    approvalStatus: APPROVAL_STATUS_VALUES.includes(approvalStatus as ProofClaimApprovalStatus)
      ? (approvalStatus as ProofClaimApprovalStatus)
      : null,
    // Clamped to the same 255-char max the backend's own listProofClaimsQuerySchema enforces —
    // matches the Projects/Service Library/Persona Library list pages' own defense-in-depth
    // precedent.
    search: search ? search.slice(0, 255) : null,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    pageSize: parsePageSize(firstValue(raw.pageSize)),
  };
}

/**
 * Builds a `/proof-and-claims-library?...` href — `overrides` wins over `current`, and changing
 * anything other than `offset` itself resets `offset` to 0, same convention as
 * `buildPersonaLibraryHref`/`buildServiceLibraryHref`.
 */
export function buildProofAndClaimsLibraryHref(
  current: ProofAndClaimsLibraryQuery,
  overrides: Partial<ProofAndClaimsLibraryQuery>,
): string {
  const next: ProofAndClaimsLibraryQuery = {
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
  return queryString ? `/proof-and-claims-library?${queryString}` : "/proof-and-claims-library";
}

export { APPROVAL_STATUS_VALUES };
