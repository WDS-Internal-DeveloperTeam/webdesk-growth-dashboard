import type { ComponentApprovalStatus } from "@webdesk/shared-types";
import type { StatusToken } from "@webdesk/ui";
import {
  ARTIFACT_APPROVAL_STATUS_LABEL,
  ARTIFACT_APPROVAL_STATUS_VALUES,
  artifactApprovalStatusBadge,
} from "./artifact-approval-status";
import { DEFAULT_PAGE_SIZE, parsePageSize, type PageSize } from "./pagination";
import { firstValue } from "./search-params";

/**
 * `ComponentLibraryQuery`/`parseComponentLibrarySearchParams`/`buildComponentLibraryHref` live in
 * their own file with zero non-type imports, rather than in `lib/component-library.ts` where the
 * server-side fetch functions live — so a `"use client"` component (the create/edit form, the
 * status-actions island) can import the real functions directly without pulling in
 * `lib/component-library.ts`'s `next/headers` import. Same precedent as
 * `lib/design-token-library-query.ts`/`lib/website-strategy-center-query.ts`/
 * `lib/persona-library-query.ts`/`lib/service-library-query.ts`.
 */

// ComponentApprovalStatus is structurally identical to ArtifactApprovalStatus (the shared 8-value
// workflow, reused verbatim by Service/Persona/Proof-and-Claims/Website Strategy Center/Design
// Token Library) — reused directly rather than re-declared here, matching every sibling module's
// own `-query.ts` file.
const APPROVAL_STATUS_VALUES: readonly ComponentApprovalStatus[] = ARTIFACT_APPROVAL_STATUS_VALUES;

export const APPROVAL_STATUS_LABEL: Readonly<Record<ComponentApprovalStatus, string>> =
  ARTIFACT_APPROVAL_STATUS_LABEL;

export function componentApprovalStatusBadge(status: ComponentApprovalStatus): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return artifactApprovalStatusBadge(status);
}

export interface ComponentLibraryQuery {
  // Free text, not an enum — the backend's own `category` filter is a plain string match against
  // a free-text field (module scope doc's own "40+ items, non-exhaustive" reasoning), unlike
  // Design Token Library's finite `group` enum.
  readonly category: string | null;
  readonly approvalStatus: ComponentApprovalStatus | null;
  readonly search: string | null;
  readonly offset: number;
  readonly pageSize: PageSize;
}

/**
 * Next.js `searchParams` is untrusted client input — `approvalStatus` is validated against the
 * same enum `GET /component-library/components` itself accepts
 * (`apps/dashboard-api/src/component-library/component-library.dto.ts`'s
 * `listComponentsQuerySchema`), so a garbled value degrades to "no filter" instead of round-
 * tripping an invalid value to the backend. `category` has no fixed value set to validate
 * against (free text) — clamped to the same 100-char max the backend's own schema enforces
 * instead. No `sortBy`/`sortOrder` param — the backend's `list()` supports neither, matching
 * `DesignTokenLibraryQuery`'s own precedent.
 */
export function parseComponentLibrarySearchParams(
  raw: Record<string, string | string[] | undefined>,
): ComponentLibraryQuery {
  const category = firstValue(raw.category);
  const approvalStatus = firstValue(raw.approvalStatus);
  const search = firstValue(raw.search);
  const offsetRaw = firstValue(raw.offset);
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0;

  return {
    category: category ? category.slice(0, 100) : null,
    approvalStatus: APPROVAL_STATUS_VALUES.includes(approvalStatus as ComponentApprovalStatus)
      ? (approvalStatus as ComponentApprovalStatus)
      : null,
    // Clamped to the same 255-char max the backend's own listComponentsQuerySchema enforces —
    // matches every sibling list page's own defense-in-depth precedent.
    search: search ? search.slice(0, 255) : null,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    pageSize: parsePageSize(firstValue(raw.pageSize)),
  };
}

/**
 * Builds a `/component-library?...` href — `overrides` wins over `current`, and changing anything
 * other than `offset` itself resets `offset` to 0, same convention as
 * `buildDesignTokenLibraryHref`/`buildWebsiteStrategyCenterHref`/`buildPersonaLibraryHref`.
 */
export function buildComponentLibraryHref(
  current: ComponentLibraryQuery,
  overrides: Partial<ComponentLibraryQuery>,
): string {
  const next: ComponentLibraryQuery = {
    ...current,
    ...overrides,
    offset: overrides.offset !== undefined ? overrides.offset : 0,
  };
  const params = new URLSearchParams();
  if (next.category) params.set("category", next.category);
  if (next.approvalStatus) params.set("approvalStatus", next.approvalStatus);
  if (next.search) params.set("search", next.search);
  if (next.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(next.pageSize));
  if (next.offset > 0) params.set("offset", String(next.offset));
  const queryString = params.toString();
  return queryString ? `/component-library?${queryString}` : "/component-library";
}
