import type { WireframeApprovalStatus, WireframeViewport } from "@webdesk/shared-types";
import type { StatusToken } from "@webdesk/ui";
import {
  ARTIFACT_APPROVAL_STATUS_LABEL,
  ARTIFACT_APPROVAL_STATUS_VALUES,
  artifactApprovalStatusBadge,
} from "./artifact-approval-status";
import { DEFAULT_PAGE_SIZE, parsePageSize, type PageSize } from "./pagination";
import { firstValue } from "./search-params";

/**
 * `WireframeLibraryQuery`/`parseWireframeLibrarySearchParams`/`buildWireframeLibraryHref` live in
 * their own file with zero non-type imports, rather than in `lib/wireframe-library.ts` where the
 * server-side fetch functions live — so a `"use client"` component (the create/edit form, the
 * status-actions island) can import the real functions directly without pulling in
 * `lib/wireframe-library.ts`'s `next/headers` import. Same precedent as
 * `lib/section-and-pattern-library-query.ts`/`lib/page-template-library-query.ts`.
 */

// WireframeApprovalStatus is structurally identical to ArtifactApprovalStatus (the shared 8-value
// workflow, reused verbatim by Section and Pattern/Page Template/Design Token/Service/Persona/
// Proof-and-Claims/Website Strategy Center Library) — reused directly rather than re-declared
// here, matching every sibling module's own `-query.ts` file.
const APPROVAL_STATUS_VALUES: readonly WireframeApprovalStatus[] = ARTIFACT_APPROVAL_STATUS_VALUES;

export const APPROVAL_STATUS_LABEL: Readonly<Record<WireframeApprovalStatus, string>> =
  ARTIFACT_APPROVAL_STATUS_LABEL;

export function wireframeApprovalStatusBadge(status: WireframeApprovalStatus): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return artifactApprovalStatusBadge(status);
}

// Mirrors packages/database/src/wireframe-library/entities.ts's WireframeViewport — kept in sync
// by hand, same approach every sibling module's own `-query.ts` file uses for its own enum.
export const VIEWPORT_VALUES: readonly WireframeViewport[] = ["mobile", "tablet", "desktop"];

export const VIEWPORT_LABEL: Readonly<Record<WireframeViewport, string>> = {
  mobile: "Mobile",
  tablet: "Tablet",
  desktop: "Desktop",
};

export interface WireframeLibraryQuery {
  readonly viewport: WireframeViewport | null;
  readonly approvalStatus: WireframeApprovalStatus | null;
  readonly search: string | null;
  readonly offset: number;
  readonly pageSize: PageSize;
}

/**
 * Next.js `searchParams` is untrusted client input — validated against the same enums
 * `GET /wireframe-library/records` itself accepts
 * (`apps/dashboard-api/src/wireframe-library/wireframe-library.dto.ts`'s
 * `listWireframeRecordsQuerySchema`) rather than passed through raw, so a garbled URL degrades to
 * the default query instead of round-tripping an invalid value to the backend. No
 * `sortBy`/`sortOrder` param — the backend's `list()` supports neither, matching
 * `SectionAndPatternLibraryQuery`'s own precedent.
 */
export function parseWireframeLibrarySearchParams(
  raw: Record<string, string | string[] | undefined>,
): WireframeLibraryQuery {
  const viewport = firstValue(raw.viewport);
  const approvalStatus = firstValue(raw.approvalStatus);
  const search = firstValue(raw.search);
  const offsetRaw = firstValue(raw.offset);
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0;

  return {
    viewport: VIEWPORT_VALUES.includes(viewport as WireframeViewport)
      ? (viewport as WireframeViewport)
      : null,
    approvalStatus: APPROVAL_STATUS_VALUES.includes(approvalStatus as WireframeApprovalStatus)
      ? (approvalStatus as WireframeApprovalStatus)
      : null,
    // Clamped to the same 255-char max the backend's own listWireframeRecordsQuerySchema
    // enforces — matches the Projects/Service Library/Persona Library/Section and Pattern
    // Library list pages' own defense-in-depth precedent.
    search: search ? search.slice(0, 255) : null,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    pageSize: parsePageSize(firstValue(raw.pageSize)),
  };
}

/**
 * Builds a `/wireframe-library?...` href — `overrides` wins over `current`, and changing anything
 * other than `offset` itself resets `offset` to 0, same convention as
 * `buildSectionAndPatternLibraryHref`/`buildPageTemplateLibraryHref`.
 */
export function buildWireframeLibraryHref(
  current: WireframeLibraryQuery,
  overrides: Partial<WireframeLibraryQuery>,
): string {
  const next: WireframeLibraryQuery = {
    ...current,
    ...overrides,
    offset: overrides.offset !== undefined ? overrides.offset : 0,
  };
  const params = new URLSearchParams();
  if (next.viewport) params.set("viewport", next.viewport);
  if (next.approvalStatus) params.set("approvalStatus", next.approvalStatus);
  if (next.search) params.set("search", next.search);
  if (next.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(next.pageSize));
  if (next.offset > 0) params.set("offset", String(next.offset));
  const queryString = params.toString();
  return queryString ? `/wireframe-library?${queryString}` : "/wireframe-library";
}
