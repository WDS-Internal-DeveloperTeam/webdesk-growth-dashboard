import type {
  PageClassification,
  PageExistingOrProposed,
  PageIndexStatus,
  PageWorkflowStage,
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
 * `PageInventoryQuery`/`parsePageInventorySearchParams`/`buildPageInventoryHref` live in their own
 * file with zero non-type imports, rather than in `lib/page-inventory.ts` where the server-side
 * fetch functions live — so a `"use client"` component (the create/edit form, the status-actions
 * island, the URLs sub-resource section) can import the real functions directly without pulling in
 * `lib/page-inventory.ts`'s `next/headers` import. Same precedent as
 * `lib/website-strategy-center-query.ts`/`lib/persona-library-query.ts`/`lib/service-library-query.ts`.
 *
 * `PageWorkflowStage` is structurally identical to `ArtifactApprovalStatus` (the shared 8-value
 * workflow, reused verbatim by Service/Persona/Proof-and-Claims/Website Strategy Center — task
 * package D8) — reused directly rather than re-declared here, matching every sibling module's own
 * `-query.ts` file. The backend's own transition route is `POST .../workflow-stage` (not `.../status`
 * like every sibling module) and its field is `workflowStage` (not `approvalStatus`) — see
 * `PageStatusActions`'s own doc comment for where that divergence actually matters.
 */
const WORKFLOW_STAGE_VALUES: readonly PageWorkflowStage[] = ARTIFACT_APPROVAL_STATUS_VALUES;

export const WORKFLOW_STAGE_LABEL: Readonly<Record<PageWorkflowStage, string>> =
  ARTIFACT_APPROVAL_STATUS_LABEL;

export function pageWorkflowStageBadge(status: PageWorkflowStage): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return artifactApprovalStatusBadge(status);
}

// Mirrors apps/dashboard-api/src/page-inventory/page-inventory.dto.ts's EXISTING_OR_PROPOSED_VALUES
// — kept in sync by hand, same approach every sibling module's own `-query.ts` file uses for its
// own enum. Not currently offered as a list-page filter (the backend's own listPagesQuerySchema has
// no existingOrProposed filter, unlike the approved wireframe's own "Existing/New" column) — used
// only by the create/edit form.
export const EXISTING_OR_PROPOSED_VALUES: readonly PageExistingOrProposed[] = [
  "existing",
  "proposed",
];
export const EXISTING_OR_PROPOSED_LABEL: Readonly<Record<PageExistingOrProposed, string>> = {
  existing: "Existing",
  proposed: "Proposed",
};

// Mirrors page-inventory.dto.ts's INDEX_STATUS_VALUES.
export const INDEX_STATUS_VALUES: readonly PageIndexStatus[] = ["index", "noindex", "unknown"];
export const INDEX_STATUS_LABEL: Readonly<Record<PageIndexStatus, string>> = {
  index: "Index",
  noindex: "No-index",
  unknown: "Unknown",
};

// Mirrors page-inventory.dto.ts's CLASSIFICATION_VALUES — roadmap-sourced only (task package D9),
// not spec-sourced, same caveat the backend's own entities.ts doc comment records.
export const CLASSIFICATION_VALUES: readonly PageClassification[] = [
  "keep",
  "optimize",
  "restructure",
  "redesign",
  "rebuild",
  "consolidate",
];
export const CLASSIFICATION_LABEL: Readonly<Record<PageClassification, string>> = {
  keep: "Keep",
  optimize: "Optimize",
  restructure: "Restructure",
  redesign: "Redesign",
  rebuild: "Rebuild",
  consolidate: "Consolidate",
};

/**
 * `projectId` is always required and always carried through every built href — pages are
 * project-scoped (`page-inventory/projects/:projectId/pages`), unlike every other module built so
 * far. Filters mirror the backend's own `listPagesQuerySchema` exactly (`pageType`/`workflowStage`/
 * `indexStatus`/`template`/`search`/`targetKeyword`/the two last-scan/last-deployment date-range
 * pairs) — no `existingOrProposed`/`roadmapPhaseId`/"owner" filter, since the backend's own query
 * schema doesn't accept the first two as filters and the spec's own required-fields list names no
 * owner column to filter by (the identical "smallest honest reading" omission every sibling list
 * page's own filter form already follows).
 */
export interface PageInventoryQuery {
  readonly projectId: string;
  readonly pageType: string | null;
  readonly workflowStage: PageWorkflowStage | null;
  readonly indexStatus: PageIndexStatus | null;
  readonly template: string | null;
  readonly search: string | null;
  readonly targetKeyword: string | null;
  readonly lastScanBefore: string | null;
  readonly lastScanAfter: string | null;
  readonly lastDeploymentBefore: string | null;
  readonly lastDeploymentAfter: string | null;
  readonly offset: number;
  readonly pageSize: PageSize;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseDateOnly(raw: string | undefined): string | null {
  return raw && DATE_PATTERN.test(raw) ? raw : null;
}

/**
 * Next.js `searchParams` is untrusted client input — validated against the same enums/shapes
 * `GET /page-inventory/projects/:projectId/pages` itself accepts
 * (`apps/dashboard-api/src/page-inventory/page-inventory.dto.ts`'s `listPagesQuerySchema`) rather
 * than passed through raw, so a garbled URL degrades to the default query instead of round-tripping
 * an invalid value to the backend. `projectId` itself is validated by the caller (a UUID check
 * against the real project list), not here — this function only parses the FILTER fields.
 */
export function parsePageInventorySearchParams(
  projectId: string,
  raw: Record<string, string | string[] | undefined>,
): PageInventoryQuery {
  const pageType = firstValue(raw.pageType);
  const workflowStage = firstValue(raw.workflowStage);
  const indexStatus = firstValue(raw.indexStatus);
  const template = firstValue(raw.template);
  const search = firstValue(raw.search);
  const targetKeyword = firstValue(raw.targetKeyword);
  const offsetRaw = firstValue(raw.offset);
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0;

  return {
    projectId,
    // Clamped to the same 255-char max the backend's own listPagesQuerySchema enforces — matches
    // every sibling list page's own defense-in-depth precedent.
    pageType: pageType ? pageType.slice(0, 255) : null,
    workflowStage: WORKFLOW_STAGE_VALUES.includes(workflowStage as PageWorkflowStage)
      ? (workflowStage as PageWorkflowStage)
      : null,
    indexStatus: INDEX_STATUS_VALUES.includes(indexStatus as PageIndexStatus)
      ? (indexStatus as PageIndexStatus)
      : null,
    template: template ? template.slice(0, 255) : null,
    search: search ? search.slice(0, 255) : null,
    targetKeyword: targetKeyword ? targetKeyword.slice(0, 255) : null,
    lastScanBefore: parseDateOnly(firstValue(raw.lastScanBefore)),
    lastScanAfter: parseDateOnly(firstValue(raw.lastScanAfter)),
    lastDeploymentBefore: parseDateOnly(firstValue(raw.lastDeploymentBefore)),
    lastDeploymentAfter: parseDateOnly(firstValue(raw.lastDeploymentAfter)),
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    pageSize: parsePageSize(firstValue(raw.pageSize)),
  };
}

/**
 * Builds a `/page-inventory?projectId=...&...` href — `overrides` wins over `current`, and changing
 * anything other than `offset` itself resets `offset` to 0, same convention as
 * `buildWebsiteStrategyCenterHref`/`buildPersonaLibraryHref`/`buildServiceLibraryHref`. `projectId`
 * is ALWAYS included first — every link within this module must preserve project context, since
 * every route hard-requires it.
 */
export function buildPageInventoryHref(
  current: PageInventoryQuery,
  overrides: Partial<PageInventoryQuery>,
): string {
  const next: PageInventoryQuery = {
    ...current,
    ...overrides,
    offset: overrides.offset !== undefined ? overrides.offset : 0,
  };
  const params = new URLSearchParams();
  params.set("projectId", next.projectId);
  if (next.pageType) params.set("pageType", next.pageType);
  if (next.workflowStage) params.set("workflowStage", next.workflowStage);
  if (next.indexStatus) params.set("indexStatus", next.indexStatus);
  if (next.template) params.set("template", next.template);
  if (next.search) params.set("search", next.search);
  if (next.targetKeyword) params.set("targetKeyword", next.targetKeyword);
  if (next.lastScanBefore) params.set("lastScanBefore", next.lastScanBefore);
  if (next.lastScanAfter) params.set("lastScanAfter", next.lastScanAfter);
  if (next.lastDeploymentBefore) params.set("lastDeploymentBefore", next.lastDeploymentBefore);
  if (next.lastDeploymentAfter) params.set("lastDeploymentAfter", next.lastDeploymentAfter);
  if (next.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(next.pageSize));
  if (next.offset > 0) params.set("offset", String(next.offset));
  return `/page-inventory?${params.toString()}`;
}

/** Builds an href to another Page Inventory route (`new`/`:pageId`/`:pageId/edit`), always
 *  preserving `?projectId=` — every route under this module hard-requires it, since the backend's
 *  own routes are `page-inventory/projects/:projectId/pages/...`. */
export function withProjectId(path: string, projectId: string): string {
  const params = new URLSearchParams({ projectId });
  return `${path}?${params.toString()}`;
}
