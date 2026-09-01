import type {
  KnowledgeLibraryRecordConfidentiality,
  KnowledgeLibraryRecordStatus,
} from "@webdesk/shared-types";
import type { StatusToken } from "@webdesk/ui";
import { DEFAULT_PAGE_SIZE, parsePageSize, type PageSize } from "./pagination";
import { firstValue } from "./search-params";

/**
 * `KnowledgeLibraryQuery`/`parseKnowledgeLibrarySearchParams`/`buildKnowledgeLibraryHref`/the
 * status label+badge maps live in their own file with zero non-type imports, rather than in
 * `lib/knowledge-library.ts` where the server-side fetch functions live — so a `"use client"`
 * component can import them directly without pulling in `lib/knowledge-library.ts`'s
 * `next/headers` import. Same precedent as `lib/business-knowledge-query.ts`/
 * `lib/persona-library-query.ts`.
 */

const STATUS_VALUES: readonly KnowledgeLibraryRecordStatus[] = [
  "draft",
  "mandatory",
  "advisory",
  "deprecated",
];

const CONFIDENTIALITY_VALUES: readonly KnowledgeLibraryRecordConfidentiality[] = [
  "public",
  "internal",
  "restricted",
];

export const STATUS_LABEL: Readonly<Record<KnowledgeLibraryRecordStatus, string>> = {
  draft: "Draft",
  mandatory: "Mandatory",
  advisory: "Advisory",
  deprecated: "Deprecated",
};

export const CONFIDENTIALITY_LABEL: Readonly<
  Record<KnowledgeLibraryRecordConfidentiality, string>
> = {
  public: "Public",
  internal: "Internal",
  restricted: "Restricted",
};

// Mirrors businessKnowledgeStatusBadge's own token choices — mandatory/advisory share the
// "healthy" token (both are approved, non-problem states), the label text disambiguates them.
const STATUS_BADGE: Readonly<
  Record<KnowledgeLibraryRecordStatus, { token: StatusToken; label: string }>
> = {
  mandatory: { token: "healthy", label: "Mandatory" },
  advisory: { token: "healthy", label: "Advisory" },
  draft: { token: "unknown", label: "Draft" },
  deprecated: { token: "notConfigured", label: "Deprecated" },
};

export function knowledgeLibraryStatusBadge(status: KnowledgeLibraryRecordStatus): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return STATUS_BADGE[status];
}

const CONFIDENTIALITY_BADGE: Readonly<
  Record<KnowledgeLibraryRecordConfidentiality, { token: StatusToken; label: string }>
> = {
  public: { token: "healthy", label: "Public" },
  internal: { token: "unknown", label: "Internal" },
  restricted: { token: "degraded", label: "Restricted" },
};

export function knowledgeLibraryConfidentialityBadge(
  confidentiality: KnowledgeLibraryRecordConfidentiality,
): { readonly token: StatusToken; readonly label: string } {
  return CONFIDENTIALITY_BADGE[confidentiality];
}

export interface KnowledgeLibraryQuery {
  readonly status: KnowledgeLibraryRecordStatus | null;
  readonly confidentiality: KnowledgeLibraryRecordConfidentiality | null;
  readonly search: string | null;
  readonly offset: number;
  readonly pageSize: PageSize;
}

/**
 * Next.js `searchParams` is untrusted client input — every field is validated against the same
 * enums `GET /knowledge-library/records` itself accepts
 * (`apps/dashboard-api/src/knowledge-library/knowledge-library.dto.ts`'s
 * `listKnowledgeLibraryRecordsQuerySchema`) rather than passed through raw, so a garbled URL
 * degrades to the default query instead of round-tripping an invalid value to the backend.
 */
export function parseKnowledgeLibrarySearchParams(
  raw: Record<string, string | string[] | undefined>,
): KnowledgeLibraryQuery {
  const status = firstValue(raw.status);
  const confidentiality = firstValue(raw.confidentiality);
  const search = firstValue(raw.search);
  const offsetRaw = firstValue(raw.offset);
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0;

  return {
    status: STATUS_VALUES.includes(status as KnowledgeLibraryRecordStatus)
      ? (status as KnowledgeLibraryRecordStatus)
      : null,
    confidentiality: CONFIDENTIALITY_VALUES.includes(
      confidentiality as KnowledgeLibraryRecordConfidentiality,
    )
      ? (confidentiality as KnowledgeLibraryRecordConfidentiality)
      : null,
    // Clamped to the same 255-char max the backend's own listKnowledgeLibraryRecordsQuerySchema
    // enforces — matches the Persona/Service Library list pages' own defense-in-depth precedent.
    search: search ? search.slice(0, 255) : null,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    pageSize: parsePageSize(firstValue(raw.pageSize)),
  };
}

/**
 * Builds a `/knowledge-library?...` href — `overrides` wins over `current`, and changing anything
 * other than `offset` itself resets `offset` to 0, same convention as `buildPersonaLibraryHref`.
 */
export function buildKnowledgeLibraryHref(
  current: KnowledgeLibraryQuery,
  overrides: Partial<KnowledgeLibraryQuery>,
): string {
  const next: KnowledgeLibraryQuery = {
    ...current,
    ...overrides,
    offset: overrides.offset !== undefined ? overrides.offset : 0,
  };
  const params = new URLSearchParams();
  if (next.status) params.set("status", next.status);
  if (next.confidentiality) params.set("confidentiality", next.confidentiality);
  if (next.search) params.set("search", next.search);
  if (next.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(next.pageSize));
  if (next.offset > 0) params.set("offset", String(next.offset));
  const queryString = params.toString();
  return queryString ? `/knowledge-library?${queryString}` : "/knowledge-library";
}

export { CONFIDENTIALITY_VALUES, STATUS_VALUES };
