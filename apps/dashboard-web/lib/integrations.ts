import { cookies } from "next/headers";
import type {
  ApiSuccessResponse,
  Integration,
  IntegrationEnvironment,
  SecretMetadata,
  WebhookEvent,
} from "@webdesk/shared-types";
import { getApiBaseUrl } from "./auth";
import { formatTimestamp } from "./format-timestamp";
import {
  buildIntegrationsHref,
  integrationActiveBadge,
  integrationStatusBadge,
  parseIntegrationsSearchParams,
  PROVIDER_LABEL,
  STATUS_LABEL,
  verificationResultBadge,
  webhookProcessingStatusBadge,
  type IntegrationsQuery,
} from "./integrations-query";
import { isUuid } from "./uuid";

export {
  buildIntegrationsHref,
  formatTimestamp,
  integrationActiveBadge,
  integrationStatusBadge,
  parseIntegrationsSearchParams,
  PROVIDER_LABEL,
  STATUS_LABEL,
  verificationResultBadge,
  webhookProcessingStatusBadge,
};
export type { IntegrationsQuery };

export interface IntegrationsListResult {
  readonly items: readonly Integration[];
  /** Same "request one row past the chosen page size" technique `getBrandLibraryRecords()`/
   *  `getProjects()` use — `GET /integrations` returns no total count to check against. */
  readonly hasNextPage: boolean;
}

/** Never degrades silently — this page's entire content IS the integration list, so a fetch
 *  failure must surface as a real error state (propagates to the nearest `error.tsx`), matching
 *  `getBrandLibraryRecords()`'s own precedent. */
export async function getIntegrations(query: IntegrationsQuery): Promise<IntegrationsListResult> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const params = new URLSearchParams();
  if (query.provider) params.set("provider", query.provider);
  if (query.status) params.set("status", query.status);
  if (query.isActive !== null) params.set("isActive", String(query.isActive));
  if (query.search) params.set("search", query.search);
  params.set("limit", String(query.pageSize + 1));
  params.set("offset", String(query.offset));

  const response = await fetch(`${apiBaseUrl}/integrations?${params.toString()}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to load integrations (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<readonly Integration[]>;
  return {
    items: body.data.slice(0, query.pageSize),
    hasNextPage: body.data.length > query.pageSize,
  };
}

/**
 * Fetches a single integration. Returns `null` on a 404 (the caller renders `notFound()`) or a
 * malformed id (rejected via `isUuid()` before any network call, the same short-circuit
 * `getBrandLibraryRecord()`/`getProjectDetail()` use), and throws on any other non-OK status
 * (403/5xx).
 */
export async function getIntegration(integrationId: string): Promise<Integration | null> {
  if (!isUuid(integrationId)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(`${apiBaseUrl}/integrations/${integrationId}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load integration (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<Integration>).data;
}

/** No pagination surfaced on the detail page — the backend's `?limit=`/`?offset=` support (added
 *  during code review, `docs/implementation/module-integrations.md`) exists to prevent an
 *  unbounded `findAll()`, not because this UI needs to page through an integration's own
 *  sub-resources; a large `limit` (matching every sibling list-fetch's own "request more than
 *  we'll ever realistically need" convention) is passed instead of building real pagination UI for
 *  a sub-resource list that's expected to stay small. */
const SUB_RESOURCE_FETCH_LIMIT = 200;

export async function getIntegrationEnvironments(
  integrationId: string,
): Promise<readonly IntegrationEnvironment[]> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(
    `${apiBaseUrl}/integrations/${integrationId}/environments?limit=${SUB_RESOURCE_FETCH_LIMIT}`,
    { headers: { cookie: cookieHeader }, cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(`Failed to load integration environments (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<readonly IntegrationEnvironment[]>).data;
}

export async function getSecretMetadata(integrationId: string): Promise<readonly SecretMetadata[]> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(
    `${apiBaseUrl}/integrations/${integrationId}/secret-metadata?limit=${SUB_RESOURCE_FETCH_LIMIT}`,
    { headers: { cookie: cookieHeader }, cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(`Failed to load secret metadata (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<readonly SecretMetadata[]>).data;
}

/** Read-only — no create/update/delete UI exists for webhook events in this pass (D-scope,
 *  `docs/implementation/module-integrations.md`'s `## dashboard-web UI` `### Scope`), so a fetch
 *  failure here is isolated from the parent integration/environments/secret-metadata fetches by
 *  the caller's own `.catch()` (see `getIntegrationDetail()`), matching `getProjectDetail()`'s own
 *  established failure-isolation pattern for a secondary section. */
export async function getWebhookEvents(integrationId: string): Promise<readonly WebhookEvent[]> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(
    `${apiBaseUrl}/integrations/${integrationId}/webhook-events?limit=${SUB_RESOURCE_FETCH_LIMIT}`,
    { headers: { cookie: cookieHeader }, cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(`Failed to load webhook events (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<readonly WebhookEvent[]>).data;
}

export interface IntegrationDetail {
  readonly integration: Integration;
  readonly environments: readonly IntegrationEnvironment[];
  readonly secretMetadata: readonly SecretMetadata[];
  readonly webhookEvents: readonly WebhookEvent[];
}

/**
 * Fetches an integration plus its three sub-resource lists in parallel. Each sub-resource fetch is
 * independently isolated via its own `.catch()` degrading to `[]` — a transient failure on, say,
 * webhook events must not crash the whole detail page, matching `getProjectDetail()`'s own
 * established failure-isolation pattern for a secondary section. (No `tolerateDiscard()` wrapping
 * is needed here — every entry is always awaited via `Promise.all`, and each already resolves
 * rather than rejects once its own `.catch()` runs, so there is no discarded-rejection warning to
 * suppress.)
 */
export async function getIntegrationDetail(
  integrationId: string,
): Promise<IntegrationDetail | null> {
  const integration = await getIntegration(integrationId);
  if (!integration) {
    return null;
  }

  const [environments, secretMetadata, webhookEvents] = await Promise.all([
    getIntegrationEnvironments(integrationId).catch((err) => {
      console.error("Failed to load integration environments", err);
      return [] as const;
    }),
    getSecretMetadata(integrationId).catch((err) => {
      console.error("Failed to load secret metadata", err);
      return [] as const;
    }),
    getWebhookEvents(integrationId).catch((err) => {
      console.error("Failed to load webhook events", err);
      return [] as const;
    }),
  ]);

  return { integration, environments, secretMetadata, webhookEvents };
}
