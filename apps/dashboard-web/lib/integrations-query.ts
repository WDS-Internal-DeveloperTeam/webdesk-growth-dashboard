import type {
  IntegrationProvider,
  IntegrationStatus,
  IntegrationVerificationResult,
  WebhookEventProcessingStatus,
} from "@webdesk/shared-types";
import type { StatusToken } from "@webdesk/ui";
import { DEFAULT_PAGE_SIZE, parsePageSize, type PageSize } from "./pagination";
import { firstValue } from "./search-params";

/**
 * `IntegrationsQuery`/`parseIntegrationsSearchParams`/`buildIntegrationsHref` and every label/badge
 * helper live in their own file with zero non-type imports, rather than in `lib/integrations.ts`
 * where the server-side fetch functions live — so a `"use client"` component (the create/edit
 * form, the verify/toggle-active/sub-resource-section islands) can import the real functions
 * directly without pulling in `lib/integrations.ts`'s `next/headers` import. Same precedent as
 * `lib/brand-library-query.ts`/`lib/content-template-library-query.ts`.
 */

export const PROVIDER_VALUES: readonly IntegrationProvider[] = [
  "github",
  "wordpress",
  "vercel_blob",
  "postgresql",
  "smtp",
  "sentry",
  "uptime_monitor",
  "vulnerability_scanner",
  "upstash",
  "other",
];

export const PROVIDER_LABEL: Readonly<Record<IntegrationProvider, string>> = {
  github: "GitHub",
  wordpress: "WordPress",
  vercel_blob: "Vercel Blob",
  postgresql: "PostgreSQL",
  smtp: "SMTP",
  sentry: "Sentry",
  uptime_monitor: "Uptime monitor",
  vulnerability_scanner: "Vulnerability scanner",
  upstash: "Upstash",
  other: "Other",
};

export const STATUS_VALUES: readonly IntegrationStatus[] = [
  "connected",
  "disconnected",
  "error",
  "not_configured",
];

export const STATUS_LABEL: Readonly<Record<IntegrationStatus, string>> = {
  connected: "Connected",
  disconnected: "Disconnected",
  error: "Error",
  not_configured: "Not configured",
};

export function integrationStatusBadge(status: IntegrationStatus): {
  readonly token: StatusToken;
  readonly label: string;
} {
  const TOKEN_BY_STATUS: Readonly<Record<IntegrationStatus, StatusToken>> = {
    connected: "healthy",
    disconnected: "degraded",
    error: "unavailable",
    not_configured: "notConfigured",
  };
  return { token: TOKEN_BY_STATUS[status], label: STATUS_LABEL[status] };
}

export const VERIFICATION_RESULT_VALUES: readonly IntegrationVerificationResult[] = [
  "success",
  "failure",
  "unknown",
];

export const VERIFICATION_RESULT_LABEL: Readonly<Record<IntegrationVerificationResult, string>> = {
  success: "Success",
  failure: "Failure",
  unknown: "Unknown",
};

export function verificationResultBadge(result: IntegrationVerificationResult | null): {
  readonly token: StatusToken;
  readonly label: string;
} {
  if (result === null) {
    return { token: "unknown", label: "Never verified" };
  }
  const TOKEN_BY_RESULT: Readonly<Record<IntegrationVerificationResult, StatusToken>> = {
    success: "healthy",
    failure: "unavailable",
    unknown: "unknown",
  };
  return { token: TOKEN_BY_RESULT[result], label: VERIFICATION_RESULT_LABEL[result] };
}

/**
 * `isActive` badge presentation — mirrors `brandLibraryPublishBadge()`'s own reasoning: `healthy`
 * for "Active" (the desired steady state) and `notConfigured` for "Inactive" (the retirement
 * mechanism, D-schema — no hard delete, matching every content-library module's own precedent).
 */
export function integrationActiveBadge(isActive: boolean): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return isActive
    ? { token: "healthy", label: "Active" }
    : { token: "notConfigured", label: "Inactive" };
}

export const WEBHOOK_PROCESSING_STATUS_VALUES: readonly WebhookEventProcessingStatus[] = [
  "received",
  "processed",
  "failed",
];

export const WEBHOOK_PROCESSING_STATUS_LABEL: Readonly<
  Record<WebhookEventProcessingStatus, string>
> = {
  received: "Received",
  processed: "Processed",
  failed: "Failed",
};

export function webhookProcessingStatusBadge(status: WebhookEventProcessingStatus): {
  readonly token: StatusToken;
  readonly label: string;
} {
  const TOKEN_BY_STATUS: Readonly<Record<WebhookEventProcessingStatus, StatusToken>> = {
    received: "unknown",
    processed: "healthy",
    failed: "unavailable",
  };
  return { token: TOKEN_BY_STATUS[status], label: WEBHOOK_PROCESSING_STATUS_LABEL[status] };
}

export interface IntegrationsQuery {
  readonly provider: IntegrationProvider | null;
  readonly status: IntegrationStatus | null;
  readonly isActive: boolean | null;
  readonly search: string | null;
  readonly offset: number;
  readonly pageSize: PageSize;
}

/**
 * Next.js `searchParams` is untrusted client input — validated against the same values
 * `GET /integrations` itself accepts (`apps/dashboard-api/src/integrations/integrations.dto.ts`'s
 * `listIntegrationsQuerySchema`) rather than passed through raw, so a garbled URL degrades to the
 * default query instead of round-tripping an invalid value to the backend. No `sortBy`/`sortOrder`
 * param — the backend's `list()` supports neither.
 */
export function parseIntegrationsSearchParams(
  raw: Record<string, string | string[] | undefined>,
): IntegrationsQuery {
  const provider = firstValue(raw.provider);
  const status = firstValue(raw.status);
  const isActiveRaw = firstValue(raw.isActive);
  const search = firstValue(raw.search);
  const offsetRaw = firstValue(raw.offset);
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0;

  return {
    provider: PROVIDER_VALUES.includes(provider as IntegrationProvider)
      ? (provider as IntegrationProvider)
      : null,
    status: STATUS_VALUES.includes(status as IntegrationStatus)
      ? (status as IntegrationStatus)
      : null,
    isActive: isActiveRaw === "true" ? true : isActiveRaw === "false" ? false : null,
    // Clamped to the same 255-char max the backend's own listIntegrationsQuerySchema enforces —
    // matches every sibling list page's own defense-in-depth precedent.
    search: search ? search.slice(0, 255) : null,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    pageSize: parsePageSize(firstValue(raw.pageSize)),
  };
}

/**
 * Builds an `/integrations?...` href — `overrides` wins over `current`, and changing anything
 * other than `offset` itself resets `offset` to 0, same convention as `buildBrandLibraryHref`/
 * `buildContentTemplateLibraryHref`.
 */
export function buildIntegrationsHref(
  current: IntegrationsQuery,
  overrides: Partial<IntegrationsQuery>,
): string {
  const next: IntegrationsQuery = {
    ...current,
    ...overrides,
    offset: overrides.offset !== undefined ? overrides.offset : 0,
  };
  const params = new URLSearchParams();
  if (next.provider) params.set("provider", next.provider);
  if (next.status) params.set("status", next.status);
  if (next.isActive !== null) params.set("isActive", String(next.isActive));
  if (next.search) params.set("search", next.search);
  if (next.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(next.pageSize));
  if (next.offset > 0) params.set("offset", String(next.offset));
  const queryString = params.toString();
  return queryString ? `/integrations?${queryString}` : "/integrations";
}
