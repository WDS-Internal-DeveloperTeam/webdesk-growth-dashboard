import type {
  BusinessKnowledgeRecordStatus,
  BusinessKnowledgeRecordType,
} from "@webdesk/shared-types";
import type { StatusToken } from "@webdesk/ui";
import { DEFAULT_PAGE_SIZE, parsePageSize, type PageSize } from "./pagination";
import { firstValue } from "./search-params";

/**
 * `BusinessKnowledgeQuery`/`parseBusinessKnowledgeSearchParams`/
 * `buildBusinessKnowledgeHref`/the record-type and status label+badge maps live in their own file
 * with zero non-type imports, rather than in `lib/business-knowledge.ts` where the server-side
 * fetch functions live — so a `"use client"` component can import them directly without pulling in
 * `lib/business-knowledge.ts`'s `next/headers` import. Same precedent as
 * `apps/dashboard-web/lib/projects-query.ts`/`status-badges.ts` — this project's own `CLAUDE.md`
 * has already flagged that gap twice (`formatTimestamp` and the roadmap/objectives status-badge
 * extractions), so this file is written the client-safe way from the start rather than reactively.
 */

// Mirrors packages/database/src/business-knowledge/entities.ts's BusinessKnowledgeRecordType.
const RECORD_TYPE_VALUES: readonly BusinessKnowledgeRecordType[] = [
  "company_profile",
  "persona_icp",
  "marketing_profile",
  "vto",
  "service_taxonomy",
  "engagement_model",
  "approved_messaging",
  "competitor",
  "geographic_scope",
  "strategic_priority",
];

const STATUS_VALUES: readonly BusinessKnowledgeRecordStatus[] = [
  "mandatory",
  "advisory",
  "draft",
  "deprecated",
  "restricted",
];

export const RECORD_TYPE_LABEL: Readonly<Record<BusinessKnowledgeRecordType, string>> = {
  company_profile: "Company Profile",
  persona_icp: "Persona / ICP",
  marketing_profile: "Marketing Profile",
  vto: "VTO",
  service_taxonomy: "Service Taxonomy",
  engagement_model: "Engagement Model",
  approved_messaging: "Approved Messaging",
  competitor: "Competitor",
  geographic_scope: "Geographic Scope",
  strategic_priority: "Strategic Priority",
};

const STATUS_BADGE: Readonly<
  Record<BusinessKnowledgeRecordStatus, { token: StatusToken; label: string }>
> = {
  // mandatory/advisory share the "healthy" token (both are approved, non-problem states) — the
  // label text disambiguates them, same reasoning `projectStatusBadge` already establishes.
  mandatory: { token: "healthy", label: "Mandatory" },
  advisory: { token: "healthy", label: "Advisory" },
  draft: { token: "unknown", label: "Draft" },
  restricted: { token: "degraded", label: "Restricted" },
  deprecated: { token: "notConfigured", label: "Deprecated" },
};

export function businessKnowledgeStatusBadge(status: BusinessKnowledgeRecordStatus): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return STATUS_BADGE[status];
}

export interface BusinessKnowledgeQuery {
  readonly recordType: BusinessKnowledgeRecordType | null;
  readonly status: BusinessKnowledgeRecordStatus | null;
  readonly offset: number;
  readonly pageSize: PageSize;
}

/**
 * Next.js `searchParams` is untrusted client input — every field is validated against the same
 * enums `GET /business-knowledge/records` itself accepts
 * (`apps/dashboard-api/src/business-knowledge/business-knowledge.dto.ts`'s
 * `listBusinessKnowledgeRecordsQuerySchema`) rather than passed through raw, so a garbled URL
 * degrades to the default query instead of round-tripping an invalid value to the backend. Unlike
 * the Projects list page, there is no `search`/`sortBy`/`sortOrder` param — the backend's `list()`
 * supports neither (a fixed `createdAt ASC` order, `recordType`/`status` filters only).
 */
export function parseBusinessKnowledgeSearchParams(
  raw: Record<string, string | string[] | undefined>,
): BusinessKnowledgeQuery {
  const recordType = firstValue(raw.recordType);
  const status = firstValue(raw.status);
  const offsetRaw = firstValue(raw.offset);
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0;

  return {
    recordType: RECORD_TYPE_VALUES.includes(recordType as BusinessKnowledgeRecordType)
      ? (recordType as BusinessKnowledgeRecordType)
      : null,
    status: STATUS_VALUES.includes(status as BusinessKnowledgeRecordStatus)
      ? (status as BusinessKnowledgeRecordStatus)
      : null,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    pageSize: parsePageSize(firstValue(raw.pageSize)),
  };
}

/**
 * Builds a `/business-knowledge-center?...` href — `overrides` wins over `current`, and changing
 * anything other than `offset` itself resets `offset` to 0, same convention as
 * `buildProjectsHref`.
 */
export function buildBusinessKnowledgeHref(
  current: BusinessKnowledgeQuery,
  overrides: Partial<BusinessKnowledgeQuery>,
): string {
  const next: BusinessKnowledgeQuery = {
    ...current,
    ...overrides,
    offset: overrides.offset !== undefined ? overrides.offset : 0,
  };
  const params = new URLSearchParams();
  if (next.recordType) params.set("recordType", next.recordType);
  if (next.status) params.set("status", next.status);
  if (next.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(next.pageSize));
  if (next.offset > 0) params.set("offset", String(next.offset));
  const queryString = params.toString();
  return queryString ? `/business-knowledge-center?${queryString}` : "/business-knowledge-center";
}

export { RECORD_TYPE_VALUES, STATUS_VALUES };
