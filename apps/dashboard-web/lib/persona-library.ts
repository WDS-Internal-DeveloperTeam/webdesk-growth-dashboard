import { cookies } from "next/headers";
import type { ApiSuccessResponse, Persona, Service } from "@webdesk/shared-types";
import { getApiBaseUrl } from "./auth";
import { formatTimestamp } from "./format-timestamp";
import {
  APPROVAL_STATUS_LABEL,
  buildPersonaLibraryHref,
  parsePersonaLibrarySearchParams,
  personaApprovalStatusBadge,
  type PersonaLibraryQuery,
} from "./persona-library-query";
import { getServices } from "./service-library";
import { isUuid } from "./uuid";

export {
  APPROVAL_STATUS_LABEL,
  buildPersonaLibraryHref,
  formatTimestamp,
  parsePersonaLibrarySearchParams,
  personaApprovalStatusBadge,
};
export type { PersonaLibraryQuery };

export interface PersonaListResult {
  readonly items: readonly Persona[];
  /** Same "request one row past the chosen page size" technique `getServices()`/`getProjects()`
   *  use — `GET /persona-library/personas` returns no total count to check against. */
  readonly hasNextPage: boolean;
}

/** Never degrades silently — this page's entire content IS the persona list, so a fetch failure
 *  must surface as a real error state (propagates to the nearest `error.tsx`), matching
 *  `getServices()`/`getProjects()`'s own precedent.
 *
 *  Known, accepted debt: this fetches (and `Persona`'s type) the full row shape per list item,
 *  including several long-text fields the list page never renders — the identical over-fetch
 *  already flagged and accepted on `getServices()`/`getBusinessKnowledgeRecords()`'s own list
 *  pages. A real fix needs a list-projection DTO on the backend, out of scope for a
 *  `dashboard-web`-only branch. */
export async function getPersonas(query: PersonaLibraryQuery): Promise<PersonaListResult> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const params = new URLSearchParams();
  if (query.approvalStatus) params.set("approvalStatus", query.approvalStatus);
  if (query.search) params.set("search", query.search);
  params.set("limit", String(query.pageSize + 1));
  params.set("offset", String(query.offset));

  const response = await fetch(`${apiBaseUrl}/persona-library/personas?${params.toString()}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to load personas (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<readonly Persona[]>;
  return {
    items: body.data.slice(0, query.pageSize),
    hasNextPage: body.data.length > query.pageSize,
  };
}

/**
 * Fetches one persona. Returns `null` on a 404 (the caller renders `notFound()`) or a malformed
 * id (rejected via `isUuid()` before any network call, the same short-circuit `getService()`/
 * `getProjectDetail()` use), and throws on any other non-OK status (403/5xx).
 */
export async function getPersona(personaId: string): Promise<Persona | null> {
  if (!isUuid(personaId)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(`${apiBaseUrl}/persona-library/personas/${personaId}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load persona (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<Persona>).data;
}

/**
 * Fetches services to populate the `relatedServiceIds` `RelationshipPicker`'s option set — reuses
 * `getServices()` (Service Library's own list fetch) rather than a new function, at the largest
 * real `PageSize` option (100). The backend's own list cap is 200 (`MAX_LIST_LIMIT`), so a
 * catalog larger than 100 rows silently shows only its first page here — the identical bound
 * every dimension-list-backed picker in this app already accepts (`ServiceLibraryForm`'s own
 * deliverable/platform/engagement-model pickers), not fixed in this pass.
 */
export async function getServicesForPersonaPicker(): Promise<readonly Service[]> {
  const { items } = await getServices({
    categoryId: null,
    approvalStatus: null,
    publicationStatus: null,
    search: null,
    offset: 0,
    pageSize: 100,
  });
  return items;
}
