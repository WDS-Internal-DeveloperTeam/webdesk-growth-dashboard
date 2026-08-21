import { cookies } from "next/headers";
import type {
  ApiSuccessResponse,
  Deliverable,
  EngagementModel,
  PlatformTechnology,
  Service,
  ServiceCategory,
  ServiceDetail,
} from "@webdesk/shared-types";
import { getApiBaseUrl } from "./auth";
import { formatTimestamp } from "./format-timestamp";
import {
  APPROVAL_STATUS_LABEL,
  buildServiceLibraryHref,
  CONFIDENTIALITY_LABEL,
  PUBLICATION_STATUS_LABEL,
  parseServiceLibrarySearchParams,
  serviceApprovalStatusBadge,
  servicePublicationStatusBadge,
  type ServiceLibraryQuery,
} from "./service-library-query";
import { isUuid } from "./uuid";

export {
  APPROVAL_STATUS_LABEL,
  buildServiceLibraryHref,
  CONFIDENTIALITY_LABEL,
  formatTimestamp,
  parseServiceLibrarySearchParams,
  PUBLICATION_STATUS_LABEL,
  serviceApprovalStatusBadge,
  servicePublicationStatusBadge,
};
export type { ServiceLibraryQuery };

export interface ServiceListResult {
  readonly items: readonly Service[];
  /** Same "request one row past the chosen page size" technique `getProjects()`/
   *  `getBusinessKnowledgeRecords()` use — `GET /service-library/services` returns no total count
   *  to check against. */
  readonly hasNextPage: boolean;
}

/** Never degrades silently — this page's entire content IS the service list, so a fetch failure
 *  must surface as a real error state (propagates to the nearest `error.tsx`), matching
 *  `getProjects()`/`getBusinessKnowledgeRecords()`'s own precedent.
 *
 *  Known, accepted debt: this fetches (and `Service` types) the full row shape per list item,
 *  including several long-text fields the list page never renders — the identical over-fetch
 *  already flagged and accepted on `getBusinessKnowledgeRecords()`'s own list page. A real fix
 *  needs a list-projection DTO on the backend (`GET /service-library/services` currently does a
 *  plain `findAll` with no `attributes` narrowing), out of scope for a `dashboard-web`-only
 *  branch. */
export async function getServices(query: ServiceLibraryQuery): Promise<ServiceListResult> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const params = new URLSearchParams();
  if (query.categoryId) params.set("categoryId", query.categoryId);
  if (query.approvalStatus) params.set("approvalStatus", query.approvalStatus);
  if (query.publicationStatus) params.set("publicationStatus", query.publicationStatus);
  if (query.search) params.set("search", query.search);
  params.set("limit", String(query.pageSize + 1));
  params.set("offset", String(query.offset));

  const response = await fetch(`${apiBaseUrl}/service-library/services?${params.toString()}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to load services (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<readonly Service[]>;
  return {
    items: body.data.slice(0, query.pageSize),
    hasNextPage: body.data.length > query.pageSize,
  };
}

/**
 * Fetches one service. Returns `null` on a 404 (the caller renders `notFound()`) or a malformed
 * id (rejected via `isUuid()` before any network call, the same short-circuit `getProjectDetail()`/
 * `getBusinessKnowledgeRecord()` use), and throws on any other non-OK status (403/5xx).
 */
export async function getService(serviceId: string): Promise<ServiceDetail | null> {
  if (!isUuid(serviceId)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(`${apiBaseUrl}/service-library/services/${serviceId}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load service (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<ServiceDetail>).data;
}

/** Shared fetch shape for the four read-only dimension endpoints below — none paginate or accept a
 *  search param (small, complete lists per `ServiceLibraryDimensionsController`'s own doc
 *  comment), so each is fetched once, in full, to populate a picker's option set. */
async function getDimensionList<T>(path: string): Promise<readonly T[]> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(`${apiBaseUrl}/service-library/${path}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to load ${path} (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<readonly T[]>).data;
}

export function getServiceCategories(): Promise<readonly ServiceCategory[]> {
  return getDimensionList<ServiceCategory>("categories");
}

export function getDeliverables(): Promise<readonly Deliverable[]> {
  return getDimensionList<Deliverable>("deliverables");
}

export function getPlatforms(): Promise<readonly PlatformTechnology[]> {
  return getDimensionList<PlatformTechnology>("platforms");
}

export function getEngagementModels(): Promise<readonly EngagementModel[]> {
  return getDimensionList<EngagementModel>("engagement-models");
}
