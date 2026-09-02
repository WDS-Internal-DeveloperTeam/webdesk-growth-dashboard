import Link from "next/link";
import type { ImportRun } from "@webdesk/shared-types";
import { ContentContainer, EmptyState, PageHeader, StatusBadge } from "@webdesk/ui";
import { PageSizeSelect } from "@/components/page-size-select";
import {
  buildImportRunsHref,
  formatTimestamp,
  getImportRuns,
  IMPORT_RUN_STATUS_LABEL,
  IMPORT_RUN_STATUS_VALUES,
  importRunStatusBadge,
  parseImportRunsSearchParams,
} from "@/lib/import-and-export-center";
import {
  filterSelectStyle as selectStyle,
  filterSubmitButtonStyle as submitButtonStyle,
} from "@/lib/list-filter-styles";
import { listTableCellStyle, listTableHeaderCellStyle } from "@/lib/list-table-styles";
import { buildHrefBySize } from "@/lib/pagination";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface ImportRunsListPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const subNavLinkStyle = { fontSize: "0.875rem" } as const;
const subNavActiveStyle = { ...subNavLinkStyle, fontWeight: 600 } as const;

/**
 * The runs list — filterable by `importTemplateId`/`status`, no direct "create" action here: a
 * run is always created from its own template's detail page (`CreateImportRunButton`), matching
 * `TriggerScanRunButton`'s own precedent of living on the parent record's own detail page rather
 * than a bare "new run" route.
 */
export default async function ImportRunsListPage({ searchParams }: ImportRunsListPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const query = parseImportRunsSearchParams(await searchParams);
  const { items: runs, hasNextPage } = await getImportRuns(query);

  const hasFilters = query.importTemplateId !== null || query.status !== null;
  const isPastLastPage = runs.length === 0 && query.offset > 0;

  return (
    <ContentContainer>
      <PageHeader
        title="Import and Export Center — Runs"
        contextActions={
          <>
            <Link href="/import-and-export-center" style={subNavLinkStyle}>
              Templates
            </Link>
            <span style={subNavActiveStyle}>Runs</span>
            <Link href="/import-and-export-center/exports" style={subNavLinkStyle}>
              Exports
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
          <span style={labelStyle}>Import template ID</span>
          <input
            key={query.importTemplateId ?? "no-template"}
            type="text"
            name="importTemplateId"
            defaultValue={query.importTemplateId ?? ""}
            maxLength={64}
            style={selectStyle}
          />
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
            {IMPORT_RUN_STATUS_VALUES.map((value) => (
              <option key={value} value={value}>
                {IMPORT_RUN_STATUS_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" style={submitButtonStyle}>
          Apply
        </button>
        {hasFilters ? (
          <Link
            href={buildImportRunsHref(query, { importTemplateId: null, status: null })}
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
              ? "No more import runs"
              : hasFilters
                ? "No import runs match your filters"
                : "No import runs yet"
          }
          description={
            isPastLastPage
              ? "You've gone past the last page of results."
              : hasFilters
                ? "Try a different template or status."
                : "Import runs are created from a template's own detail page."
          }
          action={
            isPastLastPage ? (
              <Link
                href={buildImportRunsHref(query, {
                  offset: Math.max(0, query.offset - query.pageSize),
                })}
                style={{ fontSize: "0.875rem" }}
              >
                Previous
              </Link>
            ) : hasFilters ? (
              <Link
                href={buildImportRunsHref(query, { importTemplateId: null, status: null })}
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
                  <th style={listTableHeaderCellStyle}>Public ID / Template</th>
                  <th style={listTableHeaderCellStyle}>Status</th>
                  <th style={listTableHeaderCellStyle}>Dry run</th>
                  <th style={listTableHeaderCellStyle}>Rows</th>
                  <th style={listTableHeaderCellStyle}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <RunRow key={run.id} run={run} />
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
                hrefBySize={buildHrefBySize((pageSize) => buildImportRunsHref(query, { pageSize }))}
              />
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {query.offset > 0 ? (
                  <Link
                    href={buildImportRunsHref(query, {
                      offset: Math.max(0, query.offset - query.pageSize),
                    })}
                  >
                    Previous
                  </Link>
                ) : null}
                {hasNextPage ? (
                  <Link
                    href={buildImportRunsHref(query, { offset: query.offset + query.pageSize })}
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

function RunRow({ run }: { readonly run: ImportRun }) {
  const badge = importRunStatusBadge(run.status);
  return (
    <tr>
      <td style={listTableCellStyle}>
        <Link href={`/import-and-export-center/runs/${run.id}`}>{run.publicId}</Link>
        <div
          style={{ fontSize: "0.75rem", color: "var(--webdesk-dashboard-color-foreground-muted)" }}
        >
          {run.importTemplateId}
        </div>
      </td>
      <td style={listTableCellStyle}>
        <StatusBadge status={badge.token} label={badge.label} />
      </td>
      <td
        style={{ ...listTableCellStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}
      >
        {run.isDryRun ? "Yes" : "No"}
      </td>
      <td
        style={{ ...listTableCellStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}
      >
        {run.totalRows} total / {run.successCount} success / {run.errorCount} error /{" "}
        {run.skippedCount} skipped
      </td>
      <td
        style={{ ...listTableCellStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}
      >
        {formatTimestamp(run.updatedAt)}
      </td>
    </tr>
  );
}
