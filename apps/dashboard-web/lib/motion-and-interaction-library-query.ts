import type {
  MotionInteractionApprovalStatus,
  MotionInteractionCategory,
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
 * `MotionAndInteractionLibraryQuery`/`parseMotionAndInteractionLibrarySearchParams`/
 * `buildMotionAndInteractionLibraryHref` live in their own file with zero non-type imports, rather
 * than in `lib/motion-and-interaction-library.ts` where the server-side fetch functions live — so a
 * `"use client"` component (the create/edit form, the status-actions island) can import the real
 * functions directly without pulling in `lib/motion-and-interaction-library.ts`'s `next/headers`
 * import. Same precedent as `lib/section-and-pattern-library-query.ts`/
 * `lib/page-template-library-query.ts`/`lib/wireframe-library-query.ts`.
 */

// MotionInteractionApprovalStatus is structurally identical to ArtifactApprovalStatus (the shared
// 8-value workflow, reused verbatim by Design Token/Section and Pattern/Page Template/Wireframe/
// Service/Persona/Proof-and-Claims/Website Strategy Center Library) — reused directly rather than
// re-declared here, matching every sibling module's own `-query.ts` file.
const APPROVAL_STATUS_VALUES: readonly MotionInteractionApprovalStatus[] =
  ARTIFACT_APPROVAL_STATUS_VALUES;

export const APPROVAL_STATUS_LABEL: Readonly<Record<MotionInteractionApprovalStatus, string>> =
  ARTIFACT_APPROVAL_STATUS_LABEL;

export function motionInteractionApprovalStatusBadge(status: MotionInteractionApprovalStatus): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return artifactApprovalStatusBadge(status);
}

// Mirrors
// apps/dashboard-api/src/motion-and-interaction-library/motion-and-interaction-library.dto.ts's
// MOTION_INTERACTION_CATEGORY_VALUES — kept in sync by hand, same approach every sibling module's
// own `-query.ts` file uses for its own enum.
export const CATEGORY_VALUES: readonly MotionInteractionCategory[] = [
  "page_transition",
  "focus_state",
  "active_state",
  "selected_state",
  "disabled_state",
  "form_feedback",
  "menu",
  "modal_drawer",
  "tooltip",
  "sticky_behavior",
  "content_reveal",
  "loader",
  "progress_indicator",
  "success_error_state",
  "notification",
  "media_control",
  "filter_search",
  "pagination",
  "copy_share",
  "anchor_scroll",
  "parallax",
  "cursor",
  "dismissal",
  "screen_reader_announcement",
  "timing_and_interruption",
  "analytics_event",
  "no_js_fallback",
];

export const CATEGORY_LABEL: Readonly<Record<MotionInteractionCategory, string>> = {
  page_transition: "Page transition",
  focus_state: "Focus state",
  active_state: "Active state",
  selected_state: "Selected state",
  disabled_state: "Disabled state",
  form_feedback: "Form feedback",
  menu: "Menu",
  modal_drawer: "Modal / drawer",
  tooltip: "Tooltip",
  sticky_behavior: "Sticky behavior",
  content_reveal: "Content reveal",
  loader: "Loader",
  progress_indicator: "Progress indicator",
  success_error_state: "Success / error state",
  notification: "Notification",
  media_control: "Media control",
  filter_search: "Filter / search",
  pagination: "Pagination",
  copy_share: "Copy / share",
  anchor_scroll: "Anchor scroll",
  parallax: "Parallax",
  cursor: "Cursor",
  dismissal: "Dismissal",
  screen_reader_announcement: "Screen reader announcement",
  timing_and_interruption: "Timing & interruption",
  analytics_event: "Analytics event",
  no_js_fallback: "No-JS fallback",
};

export interface MotionAndInteractionLibraryQuery {
  readonly category: MotionInteractionCategory | null;
  readonly approvalStatus: MotionInteractionApprovalStatus | null;
  readonly search: string | null;
  readonly offset: number;
  readonly pageSize: PageSize;
}

/**
 * Next.js `searchParams` is untrusted client input — validated against the same enums
 * `GET /motion-and-interaction-library/records` itself accepts
 * (`apps/dashboard-api/src/motion-and-interaction-library/motion-and-interaction-library.dto.ts`'s
 * `listMotionInteractionRecordsQuerySchema`) rather than passed through raw, so a garbled URL
 * degrades to the default query instead of round-tripping an invalid value to the backend. No
 * `sortBy`/`sortOrder` param — the backend's `list()` supports neither, matching
 * `SectionAndPatternLibraryQuery`'s own precedent.
 */
export function parseMotionAndInteractionLibrarySearchParams(
  raw: Record<string, string | string[] | undefined>,
): MotionAndInteractionLibraryQuery {
  const category = firstValue(raw.category);
  const approvalStatus = firstValue(raw.approvalStatus);
  const search = firstValue(raw.search);
  const offsetRaw = firstValue(raw.offset);
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0;

  return {
    category: CATEGORY_VALUES.includes(category as MotionInteractionCategory)
      ? (category as MotionInteractionCategory)
      : null,
    approvalStatus: APPROVAL_STATUS_VALUES.includes(
      approvalStatus as MotionInteractionApprovalStatus,
    )
      ? (approvalStatus as MotionInteractionApprovalStatus)
      : null,
    // Clamped to the same 255-char max the backend's own listMotionInteractionRecordsQuerySchema
    // enforces — matches the Projects/Service Library/Persona Library/Section and Pattern
    // Library list pages' own defense-in-depth precedent.
    search: search ? search.slice(0, 255) : null,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    pageSize: parsePageSize(firstValue(raw.pageSize)),
  };
}

/**
 * Builds a `/motion-and-interaction-library?...` href — `overrides` wins over `current`, and
 * changing anything other than `offset` itself resets `offset` to 0, same convention as
 * `buildSectionAndPatternLibraryHref`/`buildPageTemplateLibraryHref`/`buildWireframeLibraryHref`.
 */
export function buildMotionAndInteractionLibraryHref(
  current: MotionAndInteractionLibraryQuery,
  overrides: Partial<MotionAndInteractionLibraryQuery>,
): string {
  const next: MotionAndInteractionLibraryQuery = {
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
  return queryString
    ? `/motion-and-interaction-library?${queryString}`
    : "/motion-and-interaction-library";
}
