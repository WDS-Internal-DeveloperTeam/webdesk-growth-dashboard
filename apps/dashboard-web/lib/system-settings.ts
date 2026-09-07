import { cookies } from "next/headers";
import type { ApiSuccessResponse, SystemSetting } from "@webdesk/shared-types";
import { getApiBaseUrl } from "./auth";
import { formatTimestamp } from "./format-timestamp";
import {
  buildSystemSettingsHref,
  parseSystemSettingsSearchParams,
  SETTING_TYPE_LABEL,
  SETTING_TYPE_VALUES,
  systemSettingActiveBadge,
  type SystemSettingsQuery,
} from "./system-settings-query";
import { isUuid } from "./uuid";

export {
  buildSystemSettingsHref,
  formatTimestamp,
  parseSystemSettingsSearchParams,
  SETTING_TYPE_LABEL,
  SETTING_TYPE_VALUES,
  systemSettingActiveBadge,
};
export type { SystemSettingsQuery };

export interface SystemSettingsListResult {
  readonly items: readonly SystemSetting[];
  /** Same "request one row past the chosen page size" technique `getBrandLibraryRecords()`/
   *  `getContentTemplates()` use — `GET /system-settings/settings` returns no total count to check
   *  against. */
  readonly hasNextPage: boolean;
}

/** Never degrades silently — this page's entire content IS the setting list, so a fetch failure
 *  must surface as a real error state (propagates to the nearest `error.tsx`), matching
 *  `getBrandLibraryRecords()`'s own precedent. */
export async function getSystemSettings(
  query: SystemSettingsQuery,
): Promise<SystemSettingsListResult> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const params = new URLSearchParams();
  if (query.settingType) params.set("settingType", query.settingType);
  if (query.isActive !== null) params.set("isActive", String(query.isActive));
  if (query.search) params.set("search", query.search);
  params.set("limit", String(query.pageSize + 1));
  params.set("offset", String(query.offset));

  const response = await fetch(`${apiBaseUrl}/system-settings/settings?${params.toString()}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to load system settings (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<readonly SystemSetting[]>;
  return {
    items: body.data.slice(0, query.pageSize),
    hasNextPage: body.data.length > query.pageSize,
  };
}

/**
 * Fetches one system setting. Returns `null` on a 404 (the caller renders `notFound()`) or a
 * malformed id (rejected via `isUuid()` before any network call, the same short-circuit
 * `getBrandLibraryRecord()`/`getContentTemplate()` use), and throws on any other non-OK status
 * (403/5xx).
 */
export async function getSystemSetting(settingId: string): Promise<SystemSetting | null> {
  if (!isUuid(settingId)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(`${apiBaseUrl}/system-settings/settings/${settingId}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load system setting (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<SystemSetting>).data;
}
