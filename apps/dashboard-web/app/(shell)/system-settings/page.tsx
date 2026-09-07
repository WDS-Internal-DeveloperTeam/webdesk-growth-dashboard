import Link from "next/link";
import type { SystemSetting } from "@webdesk/shared-types";
import { ContentContainer, EmptyState, PageHeader, StatusBadge } from "@webdesk/ui";
import { PageSizeSelect } from "@/components/page-size-select";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import {
  filterSelectStyle as selectStyle,
  filterSubmitButtonStyle as submitButtonStyle,
} from "@/lib/list-filter-styles";
import { listTableCellStyle, listTableHeaderCellStyle } from "@/lib/list-table-styles";
import { buildHrefBySize } from "@/lib/pagination";
import { getServerSession } from "@/lib/server-session";
import {
  buildSystemSettingsHref,
  formatTimestamp,
  getSystemSettings,
  parseSystemSettingsSearchParams,
  SETTING_TYPE_LABEL,
  SETTING_TYPE_VALUES,
  systemSettingActiveBadge,
} from "@/lib/system-settings";

export const dynamic = "force-dynamic";

interface SystemSettingsListPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * No approved wireframe/screen spec exists for this module
 * (`03_Detailed_Module_Specifications.md §42` is a flat field list, no screen description) —
 * renders exactly what `GET /system-settings/settings` returns and supports (a `settingType`
 * filter, an `isActive` filter, `search`, and offset pagination, no sort), matching the Brand/
 * Content Template/Persona Library list pages' own "smallest honest reading" precedent for an
 * unsourced screen.
 */
export default async function SystemSettingsListPage({
  searchParams,
}: SystemSettingsListPageProps) {
  // The (shell) layout already redirects unauthenticated callers to sign-in before this page
  // renders — this defensive fallback avoids firing the list fetch in parallel with a redirect
  // that would just discard the result, matching every other page in this app.
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const query = parseSystemSettingsSearchParams(await searchParams);
  const { items: settings, hasNextPage } = await getSystemSettings(query);
  const hasFilters = query.settingType !== null || query.isActive !== null;
  const isPastLastPage = settings.length === 0 && query.offset > 0;

  return (
    <ContentContainer>
      <PageHeader
        title="System Settings"
        contextActions={
          <Link href="/system-settings/new" style={primaryActionLinkStyle}>
            New setting
          </Link>
        }
      />

      <form
        method="get"
        style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.5rem" }}
      >
        {/* Preserves the reader's page-size choice across a filter submit — without it, a native
            GET form submission builds its target URL purely from this form's own named fields,
            silently dropping any existing `?pageSize=` and resetting it back to the default. */}
        <input type="hidden" name="pageSize" value={query.pageSize} />
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span
            style={{
              fontSize: "0.75rem",
              color: "var(--webdesk-dashboard-color-foreground-muted)",
            }}
          >
            Setting type
          </span>
          {/* `key` forces a remount whenever the underlying filter value changes, including back
              to "" on Clear filters — a Next.js <Link> soft-navigation otherwise re-renders this
              same DOM node in place, and an uncontrolled <select>'s defaultValue only takes effect
              on first mount (see brand-library/page.tsx's own identical note). */}
          <select
            key={query.settingType ?? "all-setting-types"}
            name="settingType"
            defaultValue={query.settingType ?? ""}
            style={selectStyle}
          >
            <option value="">All setting types</option>
            {SETTING_TYPE_VALUES.map((value) => (
              <option key={value} value={value}>
                {SETTING_TYPE_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span
            style={{
              fontSize: "0.75rem",
              color: "var(--webdesk-dashboard-color-foreground-muted)",
            }}
          >
            Active state
          </span>
          <select
            key={query.isActive === null ? "all-active-states" : String(query.isActive)}
            name="isActive"
            defaultValue={query.isActive === null ? "" : String(query.isActive)}
            style={selectStyle}
          >
            <option value="">All active states</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span
            style={{
              fontSize: "0.75rem",
              color: "var(--webdesk-dashboard-color-foreground-muted)",
            }}
          >
            Search
          </span>
          <input
            key={query.search ?? "no-search"}
            type="text"
            name="search"
            defaultValue={query.search ?? ""}
            maxLength={255}
            style={selectStyle}
          />
        </label>
        <button type="submit" style={submitButtonStyle}>
          Apply
        </button>
        {hasFilters || query.search ? (
          <Link
            href="/system-settings"
            style={{ alignSelf: "flex-end", fontSize: "0.875rem", padding: "0.4rem 0" }}
          >
            Clear filters
          </Link>
        ) : null}
      </form>

      {settings.length === 0 ? (
        <EmptyState
          title={
            isPastLastPage
              ? "No more system settings"
              : hasFilters || query.search
                ? "No system settings match your filters"
                : "No system settings yet"
          }
          description={
            isPastLastPage
              ? "You've gone past the last page of results."
              : hasFilters || query.search
                ? "Try a different type, active state, or search term."
                : "System settings created for this organization will appear here."
          }
          action={
            isPastLastPage ? (
              <Link
                href={buildSystemSettingsHref(query, {
                  offset: Math.max(0, query.offset - query.pageSize),
                })}
                style={{ fontSize: "0.875rem" }}
              >
                Previous
              </Link>
            ) : hasFilters || query.search ? (
              <Link href="/system-settings" style={{ fontSize: "0.875rem" }}>
                Clear filters
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Key</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Active</th>
                  <th style={thStyle}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {settings.map((setting) => (
                  <SystemSettingRow key={setting.id} setting={setting} />
                ))}
              </tbody>
            </table>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "1rem",
              fontSize: "0.875rem",
            }}
          >
            <span style={{ color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
              Showing {query.offset + 1}–{query.offset + settings.length}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
              <PageSizeSelect
                value={query.pageSize}
                hrefBySize={buildHrefBySize((pageSize) =>
                  buildSystemSettingsHref(query, { pageSize }),
                )}
              />
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {query.offset > 0 ? (
                  <Link
                    href={buildSystemSettingsHref(query, {
                      offset: Math.max(0, query.offset - query.pageSize),
                    })}
                  >
                    Previous
                  </Link>
                ) : null}
                {hasNextPage ? (
                  <Link
                    href={buildSystemSettingsHref(query, {
                      offset: query.offset + query.pageSize,
                    })}
                  >
                    Next
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </>
      )}
    </ContentContainer>
  );
}

const thStyle = listTableHeaderCellStyle;

const tdStyle = listTableCellStyle;

function SystemSettingRow({ setting }: { readonly setting: SystemSetting }) {
  const activeBadge = systemSettingActiveBadge(setting.isActive);
  return (
    <tr>
      <td style={tdStyle}>
        <Link href={`/system-settings/${setting.id}`}>{setting.key}</Link>
      </td>
      <td style={tdStyle}>{SETTING_TYPE_LABEL[setting.settingType]}</td>
      <td style={tdStyle}>
        <StatusBadge status={activeBadge.token} label={activeBadge.label} />
      </td>
      <td style={{ ...tdStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
        {formatTimestamp(setting.updatedAt)}
      </td>
    </tr>
  );
}
