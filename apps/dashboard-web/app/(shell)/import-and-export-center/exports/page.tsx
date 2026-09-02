import Link from "next/link";
import type { ExportRun, ModuleRegistrySummary } from "@webdesk/shared-types";
import { ContentContainer, EmptyState, PageHeader, StatusBadge } from "@webdesk/ui";
import { PageSizeSelect } from "@/components/page-size-select";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import {
  buildExportRunsHref,
  EXPORT_RUN_STATUS_LABEL,
  EXPORT_RUN_STATUS_VALUES,
  exportRunStatusBadge,
  formatTimestamp,
  getExportRuns,
  IMPORT_EXPORT_FILE_FORMAT_LABEL,
  moduleDisplayName,
  parseExportRunsSearchParams,
  sortModulesForPicker,
} from "@/lib/import-and-export-center";
import {
  filterSelectStyle as selectStyle,
  filterSubmitButtonStyle as submitButtonStyle,
} from "@/lib/list-filter-styles";
import { listTableCellStyle, listTableHeaderCellStyle } from "@/lib/list-table-styles";
import { buildHrefBySize } from "@/lib/pagination";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface ExportRunsListPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const subNavLinkStyle = { fontSize: "0.875rem" } as const;
const subNavActiveStyle = { ...subNavLinkStyle, fontWeight: 600 } as const;

/**
 * The export runs list. No `search` filter — `listExportRunsQuerySchema` deliberately has none
 * (`export_runs` has no genuine free-text field to search), so this page doesn't add a
 * client-side-only search that would silently do nothing.
 */
export default async function ExportRunsListPage({ searchParams }: ExportRunsListPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const query = parseExportRunsSearchParams(await searchParams);
  const { items: runs, hasNextPage } = await getExportRuns(query);
  const modules = sortModulesForPicker(session.navigation);

  const hasFilters = query.targetModuleKey !== null || query.status !== null;
  const isPastLastPage = runs.length === 0 && query.offset > 0;

  return (
    <ContentContainer>
      <PageHeader
        title="Import and Export Center — Exports"
        contextActions={
          <>
            <Link href="/import-and-export-center" style={subNavLinkStyle}>
              Templates
            </Link>
            <Link href="/import-and-export-center/runs" style={subNavLinkStyle}>
              Runs
            </Link>
            <span style={subNavActiveStyle}>Exports</span>
            <Link href="/import-and-export-center/exports/new" style={primaryActionLinkStyle}>
              New export
            </Link>
          </>
        }
      />

      <form
        method="get"
        style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.5rem" }}
      >
        <input type="hidden" name="pageSize" value={query.pageSize} />
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span style={labelStyle}>Target module</span>
          <select
            key={query.targetModuleKey ?? "all-modules"}
            name="targetModuleKey"
            defaultValue={query.targetModuleKey ?? ""}
            style={selectStyle}
          >
            <option value="">All modules</option>
            {modules.map((module) => (
              <option key={module.key} value={module.key}>
                {moduleDisplayName(module)}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span style={labelStyle}>Status</span>
          <select
            key={query.status ?? "all-statuses"}
            name="status"
            defaultValue={query.status ?? ""}
            style={selectStyle}
          >
            <option value="">All statuses</option>
            {EXPORT_RUN_STATUS_VALUES.map((value) => (
              <option key={value} value={value}>
                {EXPORT_RUN_STATUS_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" style={submitButtonStyle}>
          Apply
        </button>
        {hasFilters ? (
          <Link
            href={buildExportRunsHref(query, { targetModuleKey: null, status: null })}
            style={{ alignSelf: "flex-end", fontSize: "0.875rem", padding: "0.4rem 0" }}
          >
            Clear filters
          </Link>
        ) : null}
      </form>

      {runs.length === 0 ? (
        <EmptyState
          title={
            isPastLastPage
              ? "No more export runs"
              : hasFilters
                ? "No export runs match your filters"
                : "No export runs yet"
          }
          description={
            isPastLastPage
              ? "You've gone past the last page of results."
              : hasFilters
                ? "Try a different module or status."
                : "Export runs will appear here."
          }
          action={
            isPastLastPage ? (
              <Link
                href={buildExportRunsHref(query, {
                  offset: Math.max(0, query.offset - query.pageSize),
                })}
                style={{ fontSize: "0.875rem" }}
              >
                Previous
              </Link>
            ) : hasFilters ? (
              <Link
                href={buildExportRunsHref(query, { targetModuleKey: null, status: null })}
                style={{ fontSize: "0.875rem" }}
              >
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
                  <th style={listTableHeaderCellStyle}>Public ID / Target module</th>
                  <th style={listTableHeaderCellStyle}>Format</th>
                  <th style={listTableHeaderCellStyle}>Status</th>
                  <th style={listTableHeaderCellStyle}>Row count</th>
                  <th style={listTableHeaderCellStyle}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <ExportRunRow key={run.id} run={run} modules={modules} />
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
              Showing {query.offset + 1}–{query.offset + runs.length}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
              <PageSizeSelect
                value={query.pageSize}
                hrefBySize={buildHrefBySize((pageSize) => buildExportRunsHref(query, { pageSize }))}
              />
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {query.offset > 0 ? (
                  <Link
                    href={buildExportRunsHref(query, {
                      offset: Math.max(0, query.offset - query.pageSize),
                    })}
                  >
                    Previous
                  </Link>
                ) : null}
                {hasNextPage ? (
                  <Link
                    href={buildExportRunsHref(query, { offset: query.offset + query.pageSize })}
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

const labelStyle = {
  fontSize: "0.75rem",
  color: "var(--webdesk-dashboard-color-foreground-muted)",
} as const;

function ExportRunRow({
  run,
  modules,
}: {
  readonly run: ExportRun;
  readonly modules: readonly ModuleRegistrySummary[];
}) {
  const badge = exportRunStatusBadge(run.status);
  const targetModule = modules.find((module) => module.key === run.targetModuleKey);
  return (
    <tr>
      <td style={listTableCellStyle}>
        <Link href={`/import-and-export-center/exports/${run.id}`}>{run.publicId}</Link>
        <div
          style={{ fontSize: "0.75rem", color: "var(--webdesk-dashboard-color-foreground-muted)" }}
        >
          {targetModule ? (targetModule.displayName ?? targetModule.name) : run.targetModuleKey}
        </div>
      </td>
      <td
        style={{ ...listTableCellStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}
      >
        {IMPORT_EXPORT_FILE_FORMAT_LABEL[run.format]}
      </td>
      <td style={listTableCellStyle}>
        <StatusBadge status={badge.token} label={badge.label} />
      </td>
      <td
        style={{ ...listTableCellStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}
      >
        {run.rowCount ?? "—"}
      </td>
      <td
        style={{ ...listTableCellStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}
      >
        {formatTimestamp(run.updatedAt)}
      </td>
    </tr>
  );
}
