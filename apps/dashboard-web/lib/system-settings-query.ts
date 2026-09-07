import type { SystemSettingType } from "@webdesk/shared-types";
import type { StatusToken } from "@webdesk/ui";
import { DEFAULT_PAGE_SIZE, parsePageSize, type PageSize } from "./pagination";
import { firstValue } from "./search-params";

/**
 * `SystemSettingsQuery`/`parseSystemSettingsSearchParams`/`buildSystemSettingsHref` live in their
 * own file with zero non-type imports, rather than in `lib/system-settings.ts` where the
 * server-side fetch functions live — so a `"use client"` component (the create/edit form, the
 * active-state-actions island) can import the real functions directly without pulling in
 * `lib/system-settings.ts`'s `next/headers` import. Same precedent as
 * `lib/brand-library-query.ts`/`lib/content-template-library-query.ts`.
 */

export const SETTING_TYPE_VALUES: readonly SystemSettingType[] = [
  "status_definition",
  "category_definition",
  "taxonomy_definition",
  "file_limit",
  "git_rule",
  "backup_rule",
  "escalation_sla",
  "documentation_rule",
  "environment",
];

export const SETTING_TYPE_LABEL: Readonly<Record<SystemSettingType, string>> = {
  status_definition: "Status definition",
  category_definition: "Category definition",
  taxonomy_definition: "Taxonomy definition",
  file_limit: "File limit",
  git_rule: "Git rule",
  backup_rule: "Backup rule",
  escalation_sla: "Escalation SLA",
  documentation_rule: "Documentation rule",
  environment: "Environment",
};

/**
 * `isActive` is this module's only status axis (no `approvalStatus` — see the shared-types doc
 * comment) — `healthy`/`notConfigured` mirror `brandLibraryPublishBadge()`'s own reasoning for the
 * identical binary shape, with no collision to weigh against since nothing else claims a token
 * here.
 */
export function systemSettingActiveBadge(isActive: boolean): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return isActive
    ? { token: "healthy", label: "Active" }
    : { token: "notConfigured", label: "Inactive" };
}

export interface SystemSettingsQuery {
  readonly settingType: SystemSettingType | null;
  readonly isActive: boolean | null;
  readonly search: string | null;
  readonly offset: number;
  readonly pageSize: PageSize;
}

/**
 * Next.js `searchParams` is untrusted client input — validated against the same values
 * `GET /system-settings/settings` itself accepts
 * (`apps/dashboard-api/src/system-settings/system-settings.dto.ts`'s
 * `listSystemSettingsQuerySchema`) rather than passed through raw, so a garbled URL degrades to
 * the default query instead of round-tripping an invalid value to the backend. No `sortBy`/
 * `sortOrder` param — the backend's `list()` supports neither.
 */
export function parseSystemSettingsSearchParams(
  raw: Record<string, string | string[] | undefined>,
): SystemSettingsQuery {
  const settingType = firstValue(raw.settingType);
  const isActiveRaw = firstValue(raw.isActive);
  const search = firstValue(raw.search);
  const offsetRaw = firstValue(raw.offset);
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0;

  return {
    settingType: SETTING_TYPE_VALUES.includes(settingType as SystemSettingType)
      ? (settingType as SystemSettingType)
      : null,
    isActive: isActiveRaw === "true" ? true : isActiveRaw === "false" ? false : null,
    // Clamped to the same 255-char max the backend's own listSystemSettingsQuerySchema enforces —
    // matches every sibling list page's own defense-in-depth precedent.
    search: search ? search.slice(0, 255) : null,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    pageSize: parsePageSize(firstValue(raw.pageSize)),
  };
}

/**
 * Builds a `/system-settings?...` href — `overrides` wins over `current`, and changing anything
 * other than `offset` itself resets `offset` to 0, same convention as
 * `buildBrandLibraryHref`/`buildContentTemplateLibraryHref`.
 */
export function buildSystemSettingsHref(
  current: SystemSettingsQuery,
  overrides: Partial<SystemSettingsQuery>,
): string {
  const next: SystemSettingsQuery = {
    ...current,
    ...overrides,
    offset: overrides.offset !== undefined ? overrides.offset : 0,
  };
  const params = new URLSearchParams();
  if (next.settingType) params.set("settingType", next.settingType);
  if (next.isActive !== null) params.set("isActive", String(next.isActive));
  if (next.search) params.set("search", next.search);
  if (next.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(next.pageSize));
  if (next.offset > 0) params.set("offset", String(next.offset));
  const queryString = params.toString();
  return queryString ? `/system-settings?${queryString}` : "/system-settings";
}
