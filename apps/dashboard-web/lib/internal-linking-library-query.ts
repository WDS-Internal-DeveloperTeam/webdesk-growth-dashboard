import type { InternalLinkPriority, InternalLinkStatus } from "@webdesk/shared-types";
import type { StatusToken } from "@webdesk/ui";
import { DEFAULT_PAGE_SIZE, parsePageSize, type PageSize } from "./pagination";
import { withProjectId } from "./project-scoped-href";
import { firstValue } from "./search-params";

export { withProjectId };

/**
 * `InternalLinkLibraryQuery`/`parseInternalLinkLibrarySearchParams`/`buildInternalLinkLibraryHref`
 * live in their own file with zero non-type imports, rather than in `lib/internal-linking-library.ts`
 * where the server-side fetch functions live — so a `"use client"` component (the create/edit form,
 * the status-actions island) can import the real functions directly without pulling in
 * `lib/internal-linking-library.ts`'s `next/headers` import. Same precedent as
 * `lib/keyword-and-entity-library-query.ts`/`lib/page-inventory-query.ts`.
 *
 * `InternalLinkStatus` is a genuinely bespoke 4-state workflow (task package D1), NOT structurally
 * identical to `ArtifactApprovalStatus` (the shared 8-value workflow every prior module — Service/
 * Persona/Proof-and-Claims/Website-Strategy-Center/Page-Inventory/Keyword-and-Entity-Library —
 * reuses) — a dedicated label/badge map is declared here, not force-fit onto
 * `lib/artifact-approval-status.ts`.
 */
export const STATUS_VALUES: readonly InternalLinkStatus[] = [
  "proposed",
  "approved",
  "implemented",
  "verified",
];

export const STATUS_LABEL: Readonly<Record<InternalLinkStatus, string>> = {
  proposed: "Proposed",
  approved: "Approved",
  implemented: "Implemented",
  verified: "Verified",
};

// 4 real statuses onto the fixed badge-token palette — proposed (not yet acted on) gets `unknown`,
// approved (agreed but not yet placed) gets `degraded` ("still in progress"), implemented (placed,
// awaiting confirmation) gets `notConfigured` (a live, positive-but-not-final state, matching the
// same token `ArtifactApprovalStatus`'s own `submitted` uses for the analogous "underway" meaning),
// and verified (placed AND confirmed live) gets `healthy` — the only fully "done" state in a
// workflow that otherwise never terminates.
const STATUS_BADGE: Readonly<Record<InternalLinkStatus, { token: StatusToken; label: string }>> = {
  proposed: { token: "unknown", label: "Proposed" },
  approved: { token: "degraded", label: "Approved" },
  implemented: { token: "notConfigured", label: "Implemented" },
  verified: { token: "healthy", label: "Verified" },
};

export function internalLinkStatusBadge(status: InternalLinkStatus): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return STATUS_BADGE[status];
}

export const PRIORITY_VALUES: readonly InternalLinkPriority[] = ["low", "medium", "high"];
export const PRIORITY_LABEL: Readonly<Record<InternalLinkPriority, string>> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const PRIORITY_BADGE: Readonly<
  Record<InternalLinkPriority, { token: StatusToken; label: string }>
> = {
  low: { token: "unknown", label: "Low" },
  medium: { token: "notConfigured", label: "Medium" },
  high: { token: "degraded", label: "High" },
};

export function internalLinkPriorityBadge(priority: InternalLinkPriority): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return PRIORITY_BADGE[priority];
}

/**
 * `projectId` is always required and always carried through every built href — internal links are
 * project-scoped (`internal-linking-library/projects/:projectId/links`), same as Page Inventory/
 * Keyword & Entity Library. Filters mirror the backend's own `listInternalLinksQuerySchema`
 * (`sourcePageId`/`targetPageId`/`status`/`priority`/`linkType`/`search`). `sourcePageId`/
 * `targetPageId` are raw uuid-shaped text filters, not resolved pickers — no name-resolution
 * endpoint is fetched for the list page's own filter bar, matching Page Inventory's own
 * `roadmapPhaseId` filter's identical "no picker" precedent.
 */
export interface InternalLinkLibraryQuery {
  readonly projectId: string;
  readonly sourcePageId: string | null;
  readonly targetPageId: string | null;
  readonly status: InternalLinkStatus | null;
  readonly priority: InternalLinkPriority | null;
  readonly linkType: string | null;
  readonly search: string | null;
  readonly offset: number;
  readonly pageSize: PageSize;
}

/**
 * Next.js `searchParams` is untrusted client input — validated against the same enums/shapes
 * `GET /internal-linking-library/projects/:projectId/links` itself accepts
 * (`apps/dashboard-api/src/internal-linking-library/internal-linking-library.dto.ts`'s
 * `listInternalLinksQuerySchema`) rather than passed through raw, so a garbled URL degrades to the
 * default query instead of round-tripping an invalid value to the backend. `projectId` itself is
 * validated by the caller (a UUID check against the real project list), not here — this function
 * only parses the FILTER fields. A malformed `sourcePageId`/`targetPageId` (not UUID-shaped) is
 * dropped to `null` rather than sent through — the backend's own `.uuid()` check would otherwise
 * reject the whole request with a 400 for what should just degrade to "no filter."
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseInternalLinkLibrarySearchParams(
  projectId: string,
  raw: Record<string, string | string[] | undefined>,
): InternalLinkLibraryQuery {
  const sourcePageId = firstValue(raw.sourcePageId);
  const targetPageId = firstValue(raw.targetPageId);
  const status = firstValue(raw.status);
  const priority = firstValue(raw.priority);
  const linkType = firstValue(raw.linkType);
  const search = firstValue(raw.search);
  const offsetRaw = firstValue(raw.offset);
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0;

  return {
    projectId,
    sourcePageId: sourcePageId && UUID_PATTERN.test(sourcePageId) ? sourcePageId : null,
    targetPageId: targetPageId && UUID_PATTERN.test(targetPageId) ? targetPageId : null,
    status: STATUS_VALUES.includes(status as InternalLinkStatus)
      ? (status as InternalLinkStatus)
      : null,
    priority: PRIORITY_VALUES.includes(priority as InternalLinkPriority)
      ? (priority as InternalLinkPriority)
      : null,
    // Clamped to the same 255-char max the backend's own listInternalLinksQuerySchema enforces on
    // this field, matching every sibling list page's own defense-in-depth precedent.
    linkType: linkType ? linkType.slice(0, 255) : null,
    search: search ? search.slice(0, 255) : null,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    pageSize: parsePageSize(firstValue(raw.pageSize)),
  };
}

/**
 * Builds a `/internal-linking-library?projectId=...&...` href — `overrides` wins over `current`,
 * and changing anything other than `offset` itself resets `offset` to 0, same convention as
 * `buildKeywordLibraryHref`/`buildPageInventoryHref`. `projectId` is ALWAYS included first — every
 * link within this module must preserve project context, since every route hard-requires it.
 */
export function buildInternalLinkLibraryHref(
  current: InternalLinkLibraryQuery,
  overrides: Partial<InternalLinkLibraryQuery>,
): string {
  const next: InternalLinkLibraryQuery = {
    ...current,
    ...overrides,
    offset: overrides.offset !== undefined ? overrides.offset : 0,
  };
  const params = new URLSearchParams();
  params.set("projectId", next.projectId);
  if (next.sourcePageId) params.set("sourcePageId", next.sourcePageId);
  if (next.targetPageId) params.set("targetPageId", next.targetPageId);
  if (next.status) params.set("status", next.status);
  if (next.priority) params.set("priority", next.priority);
  if (next.linkType) params.set("linkType", next.linkType);
  if (next.search) params.set("search", next.search);
  if (next.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(next.pageSize));
  if (next.offset > 0) params.set("offset", String(next.offset));
  return `/internal-linking-library?${params.toString()}`;
}
