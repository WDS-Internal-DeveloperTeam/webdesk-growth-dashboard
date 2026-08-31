import type { DesignTokenApprovalStatus, DesignTokenGroup } from "@webdesk/shared-types";
import type { StatusToken } from "@webdesk/ui";
import {
  ARTIFACT_APPROVAL_STATUS_LABEL,
  ARTIFACT_APPROVAL_STATUS_VALUES,
  artifactApprovalStatusBadge,
} from "./artifact-approval-status";
import { DEFAULT_PAGE_SIZE, parsePageSize, type PageSize } from "./pagination";
import { firstValue } from "./search-params";

/**
 * `DesignTokenLibraryQuery`/`parseDesignTokenLibrarySearchParams`/`buildDesignTokenLibraryHref`
 * live in their own file with zero non-type imports, rather than in `lib/design-token-library.ts`
 * where the server-side fetch functions live — so a `"use client"` component (the create/edit
 * form, the status-actions island) can import the real functions directly without pulling in
 * `lib/design-token-library.ts`'s `next/headers` import. Same precedent as
 * `lib/website-strategy-center-query.ts`/`lib/persona-library-query.ts`/
 * `lib/service-library-query.ts`.
 */

// DesignTokenApprovalStatus is structurally identical to ArtifactApprovalStatus (the shared
// 8-value workflow, reused verbatim by Service/Persona/Proof-and-Claims/Website Strategy Center
// Library) — reused directly rather than re-declared here, matching every sibling module's own
// `-query.ts` file.
const APPROVAL_STATUS_VALUES: readonly DesignTokenApprovalStatus[] =
  ARTIFACT_APPROVAL_STATUS_VALUES;

export const APPROVAL_STATUS_LABEL: Readonly<Record<DesignTokenApprovalStatus, string>> =
  ARTIFACT_APPROVAL_STATUS_LABEL;

export function designTokenApprovalStatusBadge(status: DesignTokenApprovalStatus): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return artifactApprovalStatusBadge(status);
}

// Mirrors apps/dashboard-api/src/design-token-library/design-token-library.dto.ts's GROUP_VALUES —
// kept in sync by hand, same approach every sibling module's own `-query.ts` file uses for its own
// enum.
export const GROUP_VALUES: readonly DesignTokenGroup[] = [
  "colors",
  "semantic_statuses",
  "theme",
  "typography",
  "spacing",
  "grids",
  "breakpoints",
  "borders",
  "shadows",
  "opacity_and_z_index",
  "icon_sizes",
  "media_ratios",
  "component_sizes",
  "motion",
  "interactive_states",
];

export const GROUP_LABEL: Readonly<Record<DesignTokenGroup, string>> = {
  colors: "Colors",
  semantic_statuses: "Semantic statuses",
  theme: "Theme",
  typography: "Typography",
  spacing: "Spacing",
  grids: "Grids",
  breakpoints: "Breakpoints",
  borders: "Borders",
  shadows: "Shadows",
  opacity_and_z_index: "Opacity & z-index",
  icon_sizes: "Icon sizes",
  media_ratios: "Media ratios",
  component_sizes: "Component sizes",
  motion: "Motion",
  interactive_states: "Interactive states",
};

export interface DesignTokenLibraryQuery {
  readonly group: DesignTokenGroup | null;
  readonly approvalStatus: DesignTokenApprovalStatus | null;
  readonly search: string | null;
  readonly offset: number;
  readonly pageSize: PageSize;
}

/**
 * Next.js `searchParams` is untrusted client input — validated against the same enums
 * `GET /design-token-library/tokens` itself accepts
 * (`apps/dashboard-api/src/design-token-library/design-token-library.dto.ts`'s
 * `listDesignTokensQuerySchema`) rather than passed through raw, so a garbled URL degrades to the
 * default query instead of round-tripping an invalid value to the backend. No `sortBy`/`sortOrder`
 * param — the backend's `list()` supports neither, matching `WebsiteStrategyCenterQuery`'s own
 * precedent.
 */
export function parseDesignTokenLibrarySearchParams(
  raw: Record<string, string | string[] | undefined>,
): DesignTokenLibraryQuery {
  const group = firstValue(raw.group);
  const approvalStatus = firstValue(raw.approvalStatus);
  const search = firstValue(raw.search);
  const offsetRaw = firstValue(raw.offset);
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0;

  return {
    group: GROUP_VALUES.includes(group as DesignTokenGroup) ? (group as DesignTokenGroup) : null,
    approvalStatus: APPROVAL_STATUS_VALUES.includes(approvalStatus as DesignTokenApprovalStatus)
      ? (approvalStatus as DesignTokenApprovalStatus)
      : null,
    // Clamped to the same 255-char max the backend's own listDesignTokensQuerySchema enforces —
    // matches the Projects/Service Library/Persona Library/Website Strategy Center list pages' own
    // defense-in-depth precedent.
    search: search ? search.slice(0, 255) : null,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    pageSize: parsePageSize(firstValue(raw.pageSize)),
  };
}

/**
 * Builds a `/design-token-library?...` href — `overrides` wins over `current`, and changing
 * anything other than `offset` itself resets `offset` to 0, same convention as
 * `buildWebsiteStrategyCenterHref`/`buildPersonaLibraryHref`.
 */
export function buildDesignTokenLibraryHref(
  current: DesignTokenLibraryQuery,
  overrides: Partial<DesignTokenLibraryQuery>,
): string {
  const next: DesignTokenLibraryQuery = {
    ...current,
    ...overrides,
    offset: overrides.offset !== undefined ? overrides.offset : 0,
  };
  const params = new URLSearchParams();
  if (next.group) params.set("group", next.group);
  if (next.approvalStatus) params.set("approvalStatus", next.approvalStatus);
  if (next.search) params.set("search", next.search);
  if (next.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(next.pageSize));
  if (next.offset > 0) params.set("offset", String(next.offset));
  const queryString = params.toString();
  return queryString ? `/design-token-library?${queryString}` : "/design-token-library";
}
