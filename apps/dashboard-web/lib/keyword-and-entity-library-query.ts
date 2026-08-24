import type { KeywordApprovalStatus, KeywordConfidence } from "@webdesk/shared-types";
import type { StatusToken } from "@webdesk/ui";
import {
  ARTIFACT_APPROVAL_STATUS_LABEL,
  ARTIFACT_APPROVAL_STATUS_VALUES,
  artifactApprovalStatusBadge,
} from "./artifact-approval-status";
import { DEFAULT_PAGE_SIZE, parsePageSize, type PageSize } from "./pagination";
import { withProjectId } from "./project-scoped-href";
import { firstValue } from "./search-params";

export { withProjectId };

/**
 * `KeywordLibraryQuery`/`EntityLibraryQuery`/their parse+build functions live in their own file
 * with zero non-type imports, rather than in `lib/keyword-and-entity-library.ts` where the
 * server-side fetch functions live — so a `"use client"` component (the create/edit forms, the
 * status-actions island, the two sub-resource sections) can import the real functions directly
 * without pulling in `lib/keyword-and-entity-library.ts`'s `next/headers` import. Same precedent as
 * `lib/page-inventory-query.ts`/`lib/website-strategy-center-query.ts`/`lib/persona-library-query.ts`.
 *
 * `KeywordApprovalStatus` is structurally identical to `ArtifactApprovalStatus` (the shared
 * 8-value workflow, reused verbatim by Service/Persona/Proof-and-Claims/Website Strategy
 * Center/Page Inventory — task package D9) — reused directly rather than re-declared here,
 * matching every sibling module's own `-query.ts` file.
 */
const APPROVAL_STATUS_VALUES: readonly KeywordApprovalStatus[] = ARTIFACT_APPROVAL_STATUS_VALUES;

export const APPROVAL_STATUS_LABEL: Readonly<Record<KeywordApprovalStatus, string>> =
  ARTIFACT_APPROVAL_STATUS_LABEL;

export function keywordApprovalStatusBadge(status: KeywordApprovalStatus): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return artifactApprovalStatusBadge(status);
}

export const CONFIDENCE_VALUES: readonly KeywordConfidence[] = ["low", "medium", "high"];
export const CONFIDENCE_LABEL: Readonly<Record<KeywordConfidence, string>> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

/**
 * `projectId` is always required and always carried through every built href — keywords are
 * project-scoped (`keyword-and-entity-library/projects/:projectId/keywords`), the same as Page
 * Inventory. Filters mirror the backend's own `listKeywordsQuerySchema`
 * (`keywordType`/`intent`/`funnelStage`/`country`/`confidence`/`approvalStatus`/`search`).
 */
export interface KeywordLibraryQuery {
  readonly projectId: string;
  readonly keywordType: string | null;
  readonly intent: string | null;
  readonly funnelStage: string | null;
  readonly country: string | null;
  readonly confidence: KeywordConfidence | null;
  readonly approvalStatus: KeywordApprovalStatus | null;
  readonly search: string | null;
  readonly offset: number;
  readonly pageSize: PageSize;
}

/**
 * Next.js `searchParams` is untrusted client input — validated against the same enums/shapes
 * `GET /keyword-and-entity-library/projects/:projectId/keywords` itself accepts
 * (`apps/dashboard-api/src/keyword-and-entity-library/keyword-and-entity-library.dto.ts`'s
 * `listKeywordsQuerySchema`) rather than passed through raw, so a garbled URL degrades to the
 * default query instead of round-tripping an invalid value to the backend. `projectId` itself is
 * validated by the caller (a UUID check against the real project list), not here — this function
 * only parses the FILTER fields.
 */
export function parseKeywordLibrarySearchParams(
  projectId: string,
  raw: Record<string, string | string[] | undefined>,
): KeywordLibraryQuery {
  const keywordType = firstValue(raw.keywordType);
  const intent = firstValue(raw.intent);
  const funnelStage = firstValue(raw.funnelStage);
  const country = firstValue(raw.country);
  const confidence = firstValue(raw.confidence);
  const approvalStatus = firstValue(raw.approvalStatus);
  const search = firstValue(raw.search);
  const offsetRaw = firstValue(raw.offset);
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0;

  return {
    projectId,
    // Clamped to the same 100-char max the backend's own listKeywordsQuerySchema enforces on
    // these four fields — matches every sibling list page's own defense-in-depth precedent.
    keywordType: keywordType ? keywordType.slice(0, 100) : null,
    intent: intent ? intent.slice(0, 100) : null,
    funnelStage: funnelStage ? funnelStage.slice(0, 100) : null,
    country: country ? country.slice(0, 100) : null,
    confidence: CONFIDENCE_VALUES.includes(confidence as KeywordConfidence)
      ? (confidence as KeywordConfidence)
      : null,
    approvalStatus: APPROVAL_STATUS_VALUES.includes(approvalStatus as KeywordApprovalStatus)
      ? (approvalStatus as KeywordApprovalStatus)
      : null,
    search: search ? search.slice(0, 500) : null,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    pageSize: parsePageSize(firstValue(raw.pageSize)),
  };
}

/**
 * Builds a `/keyword-and-entity-library?projectId=...&...` href — `overrides` wins over `current`,
 * and changing anything other than `offset` itself resets `offset` to 0, same convention as
 * `buildPageInventoryHref`/`buildWebsiteStrategyCenterHref`/`buildPersonaLibraryHref`. `projectId`
 * is ALWAYS included first — every link within this module must preserve project context, since
 * every route hard-requires it.
 */
export function buildKeywordLibraryHref(
  current: KeywordLibraryQuery,
  overrides: Partial<KeywordLibraryQuery>,
): string {
  const next: KeywordLibraryQuery = {
    ...current,
    ...overrides,
    offset: overrides.offset !== undefined ? overrides.offset : 0,
  };
  const params = new URLSearchParams();
  params.set("projectId", next.projectId);
  if (next.keywordType) params.set("keywordType", next.keywordType);
  if (next.intent) params.set("intent", next.intent);
  if (next.funnelStage) params.set("funnelStage", next.funnelStage);
  if (next.country) params.set("country", next.country);
  if (next.confidence) params.set("confidence", next.confidence);
  if (next.approvalStatus) params.set("approvalStatus", next.approvalStatus);
  if (next.search) params.set("search", next.search);
  if (next.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(next.pageSize));
  if (next.offset > 0) params.set("offset", String(next.offset));
  return `/keyword-and-entity-library?${params.toString()}`;
}

/**
 * `projectId` is always required. Filters mirror the backend's own `listEntitiesQuerySchema`
 * (`entityType`/`search`) — entities have no approval status of their own (task package D3).
 */
export interface EntityLibraryQuery {
  readonly projectId: string;
  readonly entityType: string | null;
  readonly search: string | null;
  readonly offset: number;
  readonly pageSize: PageSize;
}

export function parseEntityLibrarySearchParams(
  projectId: string,
  raw: Record<string, string | string[] | undefined>,
): EntityLibraryQuery {
  const entityType = firstValue(raw.entityType);
  const search = firstValue(raw.search);
  const offsetRaw = firstValue(raw.offset);
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0;

  return {
    projectId,
    entityType: entityType ? entityType.slice(0, 100) : null,
    search: search ? search.slice(0, 255) : null,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    pageSize: parsePageSize(firstValue(raw.pageSize)),
  };
}

export function buildEntityLibraryHref(
  current: EntityLibraryQuery,
  overrides: Partial<EntityLibraryQuery>,
): string {
  const next: EntityLibraryQuery = {
    ...current,
    ...overrides,
    offset: overrides.offset !== undefined ? overrides.offset : 0,
  };
  const params = new URLSearchParams();
  params.set("projectId", next.projectId);
  if (next.entityType) params.set("entityType", next.entityType);
  if (next.search) params.set("search", next.search);
  if (next.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(next.pageSize));
  if (next.offset > 0) params.set("offset", String(next.offset));
  return `/keyword-and-entity-library/entities?${params.toString()}`;
}
