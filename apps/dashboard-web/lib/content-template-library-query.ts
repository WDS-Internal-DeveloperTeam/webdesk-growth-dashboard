import type { ContentTemplateApprovalStatus } from "@webdesk/shared-types";
import type { StatusToken } from "@webdesk/ui";
import {
  ARTIFACT_APPROVAL_STATUS_LABEL,
  ARTIFACT_APPROVAL_STATUS_VALUES,
  artifactApprovalStatusBadge,
} from "./artifact-approval-status";
import { DEFAULT_PAGE_SIZE, parsePageSize, type PageSize } from "./pagination";
import { firstValue } from "./search-params";

/**
 * `ContentTemplateLibraryQuery`/`parseContentTemplateLibrarySearchParams`/
 * `buildContentTemplateLibraryHref` live in their own file with zero non-type imports, rather than
 * in `lib/content-template-library.ts` where the server-side fetch functions live — so a
 * `"use client"` component (the create/edit form, the status/publish-actions islands) can import
 * the real functions directly without pulling in `lib/content-template-library.ts`'s `next/headers`
 * import. Same precedent as `lib/persona-library-query.ts`/`lib/service-library-query.ts`.
 */

// ContentTemplateApprovalStatus is structurally identical to ArtifactApprovalStatus (Persona/
// Service Library's own identical 8-value workflow, reused verbatim per task package D4) — reused
// directly rather than re-declared here, matching every sibling module's own precedent for this
// shared vocabulary.
const APPROVAL_STATUS_VALUES: readonly ContentTemplateApprovalStatus[] =
  ARTIFACT_APPROVAL_STATUS_VALUES;

export const APPROVAL_STATUS_LABEL: Readonly<Record<ContentTemplateApprovalStatus, string>> =
  ARTIFACT_APPROVAL_STATUS_LABEL;

export function contentTemplateApprovalStatusBadge(status: ContentTemplateApprovalStatus): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return artifactApprovalStatusBadge(status);
}

/**
 * `isPublished` badge presentation — no sibling precedent, this is the first module with a real
 * publish/unpublish mechanism (task package D1). `healthy`/`unknown` chosen so "Published" never
 * shares a token with any of the approval-status badge's own live/in-progress tokens
 * (`unknown`/`notConfigured`/`degraded`), keeping the two badges visually distinguishable when
 * shown side by side.
 */
export function contentTemplatePublishBadge(isPublished: boolean): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return isPublished
    ? { token: "healthy", label: "Published" }
    : { token: "unknown", label: "Unpublished" };
}

export interface ContentTemplateLibraryQuery {
  readonly approvalStatus: ContentTemplateApprovalStatus | null;
  readonly isPublished: boolean | null;
  readonly search: string | null;
  readonly offset: number;
  readonly pageSize: PageSize;
}

/**
 * Next.js `searchParams` is untrusted client input — validated against the same values
 * `GET /content-template-library/templates` itself accepts
 * (`apps/dashboard-api/src/content-template-library/content-template-library.dto.ts`'s
 * `listContentTemplatesQuerySchema`) rather than passed through raw, so a garbled URL degrades to
 * the default query instead of round-tripping an invalid value to the backend. No `sortBy`/
 * `sortOrder` param — the backend's `list()` supports neither.
 */
export function parseContentTemplateLibrarySearchParams(
  raw: Record<string, string | string[] | undefined>,
): ContentTemplateLibraryQuery {
  const approvalStatus = firstValue(raw.approvalStatus);
  const isPublishedRaw = firstValue(raw.isPublished);
  const search = firstValue(raw.search);
  const offsetRaw = firstValue(raw.offset);
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0;

  return {
    approvalStatus: APPROVAL_STATUS_VALUES.includes(approvalStatus as ContentTemplateApprovalStatus)
      ? (approvalStatus as ContentTemplateApprovalStatus)
      : null,
    isPublished: isPublishedRaw === "true" ? true : isPublishedRaw === "false" ? false : null,
    // Clamped to the same 255-char max the backend's own listContentTemplatesQuerySchema
    // enforces — matches every sibling list page's own defense-in-depth precedent.
    search: search ? search.slice(0, 255) : null,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    pageSize: parsePageSize(firstValue(raw.pageSize)),
  };
}

/**
 * Builds a `/content-template-library?...` href — `overrides` wins over `current`, and changing
 * anything other than `offset` itself resets `offset` to 0, same convention as
 * `buildPersonaLibraryHref`.
 */
export function buildContentTemplateLibraryHref(
  current: ContentTemplateLibraryQuery,
  overrides: Partial<ContentTemplateLibraryQuery>,
): string {
  const next: ContentTemplateLibraryQuery = {
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
  return queryString ? `/content-template-library?${queryString}` : "/content-template-library";
}

export { APPROVAL_STATUS_VALUES };
