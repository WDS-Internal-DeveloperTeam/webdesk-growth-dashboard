import { cookies } from "next/headers";
import type {
  ApiSuccessResponse,
  ComponentRecord,
  MotionInteractionRecord,
} from "@webdesk/shared-types";
import { getApiBaseUrl } from "./auth";
import { getComponents } from "./component-library";
import { formatTimestamp } from "./format-timestamp";
import {
  APPROVAL_STATUS_LABEL,
  buildMotionAndInteractionLibraryHref,
  CATEGORY_LABEL,
  CATEGORY_VALUES,
  motionInteractionApprovalStatusBadge,
  parseMotionAndInteractionLibrarySearchParams,
  type MotionAndInteractionLibraryQuery,
} from "./motion-and-interaction-library-query";
import { isUuid } from "./uuid";

export {
  APPROVAL_STATUS_LABEL,
  buildMotionAndInteractionLibraryHref,
  CATEGORY_LABEL,
  CATEGORY_VALUES,
  formatTimestamp,
  motionInteractionApprovalStatusBadge,
  parseMotionAndInteractionLibrarySearchParams,
};
export type { MotionAndInteractionLibraryQuery };

export interface MotionInteractionListResult {
  readonly items: readonly MotionInteractionRecord[];
  /** Same "request one row past the chosen page size" technique `getSectionPatterns()`/
   *  `getPageTemplates()`/`getWireframes()` use — `GET /motion-and-interaction-library/records`
   *  returns no total count to check against. */
  readonly hasNextPage: boolean;
}

/** Never degrades silently — this page's entire content IS the record list, so a fetch failure
 *  must surface as a real error state (propagates to the nearest `error.tsx`), matching every
 *  sibling module's own list-fetch precedent. */
export async function getMotionInteractionRecords(
  query: MotionAndInteractionLibraryQuery,
): Promise<MotionInteractionListResult> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const params = new URLSearchParams();
  if (query.category) params.set("category", query.category);
  if (query.approvalStatus) params.set("approvalStatus", query.approvalStatus);
  if (query.search) params.set("search", query.search);
  params.set("limit", String(query.pageSize + 1));
  params.set("offset", String(query.offset));

  const response = await fetch(
    `${apiBaseUrl}/motion-and-interaction-library/records?${params.toString()}`,
    {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to load motion/interaction records (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<readonly MotionInteractionRecord[]>;
  return {
    items: body.data.slice(0, query.pageSize),
    hasNextPage: body.data.length > query.pageSize,
  };
}

/**
 * Fetches the CURRENT version of one motion/interaction record, by its stable `recordId` — not
 * the row `id` (which changes across a version fork). Returns `null` on a 404 (the caller renders
 * `notFound()`) or a malformed id (rejected via `isUuid()` before any network call, the same
 * short-circuit `getSectionPattern()`/`getPageTemplate()`/`getWireframe()` use), and throws on any
 * other non-OK status (403/5xx).
 */
export async function getMotionInteractionRecord(
  recordId: string,
): Promise<MotionInteractionRecord | null> {
  if (!isUuid(recordId)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(`${apiBaseUrl}/motion-and-interaction-library/records/${recordId}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load motion/interaction record (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<MotionInteractionRecord>).data;
}

/**
 * Fetches every version of one motion/interaction record, oldest first (the backend's own order —
 * see `MotionInteractionRecordRepository.listVersions()`), for the detail page's "Version history"
 * section. Returns an empty array rather than throwing on a malformed id (the same short-circuit
 * `getMotionInteractionRecord()` uses) or on a 404 — the detail page already gates its own
 * rendering on `getMotionInteractionRecord()`'s own `null`/`notFound()` result, so a genuinely-
 * missing record never reaches a point where this function's result matters; degrading here
 * instead of throwing just avoids a second, redundant not-found code path. Any other non-OK status
 * still throws, matching every other fetch function in this module.
 */
export async function getMotionInteractionRecordVersions(
  recordId: string,
): Promise<readonly MotionInteractionRecord[]> {
  if (!isUuid(recordId)) {
    return [];
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(
    `${apiBaseUrl}/motion-and-interaction-library/records/${recordId}/versions`,
    {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    },
  );
  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    throw new Error(
      `Failed to load motion/interaction record versions (status ${response.status})`,
    );
  }
  return ((await response.json()) as ApiSuccessResponse<readonly MotionInteractionRecord[]>).data;
}

/**
 * Fetches Component Library records to populate the `relatedComponentIds` `RelationshipPicker`'s
 * option set — reuses `getComponents()` (Component Library's own list fetch), same reasoning as
 * `getComponentsForPageTemplatePicker()`. Degrades to an empty list on failure rather than
 * crashing this module's own create/detail/edit pages over a transient Component Library outage.
 */
export async function getComponentsForMotionInteractionPicker(): Promise<
  readonly ComponentRecord[]
> {
  try {
    const { items } = await getComponents({
      category: null,
      approvalStatus: null,
      search: null,
      offset: 0,
      pageSize: 100,
    });
    return items;
  } catch (error) {
    console.error(
      "Failed to load components for the motion/interaction relationship picker:",
      error,
    );
    return [];
  }
}
