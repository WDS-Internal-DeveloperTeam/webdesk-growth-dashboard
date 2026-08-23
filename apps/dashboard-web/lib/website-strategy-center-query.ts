import type {
  WebsiteStrategyApprovalStatus,
  WebsiteStrategyRecordType,
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
 * `WebsiteStrategyCenterQuery`/`parseWebsiteStrategyCenterSearchParams`/
 * `buildWebsiteStrategyCenterHref` live in their own file with zero non-type imports, rather than
 * in `lib/website-strategy-center.ts` where the server-side fetch functions live — so a
 * `"use client"` component (the create/edit form, the status-actions island) can import the real
 * functions directly without pulling in `lib/website-strategy-center.ts`'s `next/headers` import.
 * Same precedent as `lib/persona-library-query.ts`/`lib/service-library-query.ts`.
 */

// WebsiteStrategyApprovalStatus is structurally identical to ArtifactApprovalStatus (the shared
// 8-value workflow, reused verbatim by Service/Persona/Proof-and-Claims Library — task package
// D6) — reused directly rather than re-declared here, matching every sibling module's own
// `-query.ts` file.
const APPROVAL_STATUS_VALUES: readonly WebsiteStrategyApprovalStatus[] =
  ARTIFACT_APPROVAL_STATUS_VALUES;

export const APPROVAL_STATUS_LABEL: Readonly<Record<WebsiteStrategyApprovalStatus, string>> =
  ARTIFACT_APPROVAL_STATUS_LABEL;

export function websiteStrategyApprovalStatusBadge(status: WebsiteStrategyApprovalStatus): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return artifactApprovalStatusBadge(status);
}

// Mirrors apps/dashboard-api/src/website-strategy-center/website-strategy-center.dto.ts's
// RECORD_TYPE_VALUES — kept in sync by hand, same approach every sibling module's own `-query.ts`
// file uses for its own enum.
export const RECORD_TYPE_VALUES: readonly WebsiteStrategyRecordType[] = [
  "navigation_plan",
  "page_clusters",
  "pillar_strategy",
  "platform_strategy",
  "industry_strategy",
  "location_strategy",
  "conversion_plan",
  "search_plan",
  "internal_link_plan",
];

export const RECORD_TYPE_LABEL: Readonly<Record<WebsiteStrategyRecordType, string>> = {
  navigation_plan: "Navigation plan",
  page_clusters: "Page clusters",
  pillar_strategy: "Pillar strategy",
  platform_strategy: "Platform strategy",
  industry_strategy: "Industry strategy",
  location_strategy: "Location strategy",
  conversion_plan: "Conversion plan",
  search_plan: "Search plan",
  internal_link_plan: "Internal-link plan",
};

export interface WebsiteStrategyCenterQuery {
  readonly recordType: WebsiteStrategyRecordType | null;
  readonly approvalStatus: WebsiteStrategyApprovalStatus | null;
  readonly search: string | null;
  readonly offset: number;
  readonly pageSize: PageSize;
}

/**
 * Next.js `searchParams` is untrusted client input — validated against the same enums
 * `GET /website-strategy-center/records` itself accepts
 * (`apps/dashboard-api/src/website-strategy-center/website-strategy-center.dto.ts`'s
 * `listWebsiteStrategyRecordsQuerySchema`) rather than passed through raw, so a garbled URL
 * degrades to the default query instead of round-tripping an invalid value to the backend. No
 * `sortBy`/`sortOrder` param — the backend's `list()` supports neither, matching
 * `WebsiteStrategyRecordRepository.list()`'s own fixed order.
 */
export function parseWebsiteStrategyCenterSearchParams(
  raw: Record<string, string | string[] | undefined>,
): WebsiteStrategyCenterQuery {
  const recordType = firstValue(raw.recordType);
  const approvalStatus = firstValue(raw.approvalStatus);
  const search = firstValue(raw.search);
  const offsetRaw = firstValue(raw.offset);
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0;

  return {
    recordType: RECORD_TYPE_VALUES.includes(recordType as WebsiteStrategyRecordType)
      ? (recordType as WebsiteStrategyRecordType)
      : null,
    approvalStatus: APPROVAL_STATUS_VALUES.includes(approvalStatus as WebsiteStrategyApprovalStatus)
      ? (approvalStatus as WebsiteStrategyApprovalStatus)
      : null,
    // Clamped to the same 255-char max the backend's own listWebsiteStrategyRecordsQuerySchema
    // enforces — matches the Projects/Service Library/Persona Library list pages' own
    // defense-in-depth precedent.
    search: search ? search.slice(0, 255) : null,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    pageSize: parsePageSize(firstValue(raw.pageSize)),
  };
}

/**
 * Builds a `/website-strategy-center?...` href — `overrides` wins over `current`, and changing
 * anything other than `offset` itself resets `offset` to 0, same convention as
 * `buildPersonaLibraryHref`/`buildServiceLibraryHref`.
 */
export function buildWebsiteStrategyCenterHref(
  current: WebsiteStrategyCenterQuery,
  overrides: Partial<WebsiteStrategyCenterQuery>,
): string {
  const next: WebsiteStrategyCenterQuery = {
    ...current,
    ...overrides,
    offset: overrides.offset !== undefined ? overrides.offset : 0,
  };
  const params = new URLSearchParams();
  if (next.recordType) params.set("recordType", next.recordType);
  if (next.approvalStatus) params.set("approvalStatus", next.approvalStatus);
  if (next.search) params.set("search", next.search);
  if (next.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(next.pageSize));
  if (next.offset > 0) params.set("offset", String(next.offset));
  const queryString = params.toString();
  return queryString ? `/website-strategy-center?${queryString}` : "/website-strategy-center";
}
