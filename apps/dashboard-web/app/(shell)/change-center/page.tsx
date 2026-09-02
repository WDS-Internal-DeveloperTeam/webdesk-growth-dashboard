import { cookies } from "next/headers";
import Link from "next/link";
import type { ChangeRecord } from "@webdesk/shared-types";
import {
  ContentContainer,
  EmptyState,
  PageHeader,
  StatusBadge,
  typographyTokens,
} from "@webdesk/ui";
import { PageSizeSelect } from "@/components/page-size-select";
import { ProjectPickerForm } from "@/components/project-picker-form";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import {
  buildChangeCenterHref,
  CATEGORY_LABEL,
  CATEGORY_VALUES,
  changeRecordSeverityBadge,
  changeRecordStatusBadge,
  parseChangeCenterSearchParams,
  SEVERITY_LABEL,
  SEVERITY_VALUES,
  STATUS_LABEL,
  STATUS_VALUES,
} from "@/lib/change-center-query";
import { getChangeRecords, tolerateDiscard, withProjectId } from "@/lib/change-center";
import { CURRENT_PROJECT_COOKIE } from "@/lib/current-project";
import {
  filterSelectStyle as selectStyle,
  filterSubmitButtonStyle as submitButtonStyle,
} from "@/lib/list-filter-styles";
import { listTableCellStyle, listTableHeaderCellStyle } from "@/lib/list-table-styles";
import { buildHrefBySize } from "@/lib/pagination";
import { getProject, getProjects } from "@/lib/projects";
import { firstValue } from "@/lib/search-params";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface ChangeCenterListPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Change records are project-scoped (`change-center/projects/:projectId/records`), same pattern
 * as Internal Linking Library/Page Inventory/Keyword & Entity Library — `?projectId=` is the
 * source of truth throughout this module. The header Project Switcher's `wds_current_project`
 * cookie stays purely advisory, only used here to PRE-SELECT the picker's default option, never to
 * bypass it. When `?projectId=` is missing or doesn't resolve to a real project, this page renders
 * a project-picker prompt instead of a table.
 *
 * Once a project is resolved, renders exactly what `GET .../records` returns and supports — the
 * filters the backend's own `listChangeRecordsQuerySchema` accepts (`category`/`severity`/
 * `status`/`scanFindingId`/`assignedToMe`/`search`). `scanFindingId` is a raw uuid-shaped text
 * filter, not a resolved picker — no `dashboard-web` UI exists yet for Scan Center to pick from,
 * matching Page Inventory's own `roadmapPhaseId` filter's identical "no picker" precedent.
 */
export default async function ChangeCenterListPage({ searchParams }: ChangeCenterListPageProps) {
  // The (shell) layout already redirects unauthenticated callers to sign-in before this page
  // renders — this defensive fallback avoids firing any fetch in parallel with a redirect that
  // would just discard the result, matching every other page in this app.
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const rawParams = await searchParams;
  const projectIdParam = firstValue(rawParams.projectId);

  // Fired concurrently with the project-existence check below, not sequentially after it —
  // getChangeRecords() only needs the raw projectId string, not any field resolved from the
  // Project entity itself, mirroring getInternalLinks()'s/getPages()'s own identical fix.
  // tolerateDiscard() avoids an unhandled-rejection warning on the branch where project turns out
  // null and this promise is never awaited.
  const recordsPromise = projectIdParam
    ? tolerateDiscard(getChangeRecords(parseChangeCenterSearchParams(projectIdParam, rawParams)))
    : null;

  const project = projectIdParam ? await getProject(projectIdParam) : null;

  if (!project) {
    const cookieStore = await cookies();
    const defaultProjectId = cookieStore.get(CURRENT_PROJECT_COOKIE)?.value ?? null;
    // Largest real page-size option (100) — the same bound every other picker in this app accepts,
    // not fixed in this pass. Sorted by name for a scannable picker.
    const { items: projects } = await getProjects({
      search: null,
      status: null,
      sortBy: "name",
      sortOrder: "ASC",
      offset: 0,
      pageSize: 100,
    });
    return (
      <ContentContainer>
        <PageHeader title="Change Center" />
        {projects.length === 0 ? (
          <EmptyState
            title="No projects yet"
            description="Change Center is scoped to a project — create a project first."
            action={
              <Link href="/projects/new" style={{ fontSize: "0.875rem" }}>
                New project
              </Link>
            }
          />
        ) : (
          <ProjectPickerForm
            projects={projects}
            defaultProjectId={defaultProjectId}
            submitLabel="View records"
          />
        )}
      </ContentContainer>
    );
  }

  const query = parseChangeCenterSearchParams(project.id, rawParams);
  const { items: records, hasNextPage } = await recordsPromise!;
  const hasFilters =
    query.category !== null ||
    query.severity !== null ||
    query.status !== null ||
    query.scanFindingId !== null ||
    query.assignedToMe;
  const isPastLastPage = records.length === 0 && query.offset > 0;
  const clearFiltersHref = withProjectId("/change-center", project.id);

  return (
    <ContentContainer>
      <PageHeader
        title={`Change Center — ${project.name}`}
        contextActions={
          <>
            <Link href={clearFiltersHref} style={{ fontSize: "0.875rem" }}>
              Switch project
            </Link>
            <Link
              href={withProjectId("/change-center/new", project.id)}
              style={primaryActionLinkStyle}
            >
              New record
            </Link>
          </>
        }
      />

      <form
        method="get"
        style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.5rem" }}
      >
        {/* projectId must always round-trip through the filter form — it's a real path segment
            downstream, not just another query param, so it's never allowed to silently drop. */}
        <input type="hidden" name="projectId" value={project.id} />
        {/* Preserves the reader's page-size choice across a filter submit — matches every sibling
            list page's own identical hidden field. */}
        <input type="hidden" name="pageSize" value={query.pageSize} />
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span style={labelStyle}>Category</span>
          <select
            key={query.category ?? "all-categories"}
            name="category"
            defaultValue={query.category ?? ""}
            style={selectStyle}
          >
            <option value="">All categories</option>
            {CATEGORY_VALUES.map((value) => (
              <option key={value} value={value}>
                {CATEGORY_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span style={labelStyle}>Severity</span>
          <select
            key={query.severity ?? "all-severities"}
            name="severity"
            defaultValue={query.severity ?? ""}
            style={selectStyle}
          >
            <option value="">All severities</option>
            {SEVERITY_VALUES.map((value) => (
              <option key={value} value={value}>
                {SEVERITY_LABEL[value]}
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
            {STATUS_VALUES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
        <TextFilter label="Scan finding ID" name="scanFindingId" value={query.scanFindingId} />
        <label
          style={{ display: "flex", alignItems: "center", gap: "0.4rem", alignSelf: "flex-end" }}
        >
          <input
            type="checkbox"
            name="assignedToMe"
            value="true"
            defaultChecked={query.assignedToMe}
          />
          <span style={labelStyle}>Assigned to me</span>
        </label>
        <button type="submit" style={submitButtonStyle}>
          Apply
        </button>
        {hasFilters ? (
          <Link
            href={clearFiltersHref}
            style={{ alignSelf: "flex-end", fontSize: "0.875rem", padding: "0.4rem 0" }}
          >
            Clear filters
          </Link>
        ) : null}
      </form>

      {records.length === 0 ? (
        <EmptyState
          title={
            isPastLastPage
              ? "No more records"
              : hasFilters
                ? "No records match your filters"
                : "No change records yet"
          }
          description={
            isPastLastPage
              ? "You've gone past the last page of results."
              : hasFilters
                ? "Try a different category, severity, status, or filter."
                : "Change records detected or created for this project will appear here."
          }
          action={
            isPastLastPage ? (
              <Link
                href={buildChangeCenterHref(query, {
                  offset: Math.max(0, query.offset - query.pageSize),
                })}
                style={{ fontSize: "0.875rem" }}
              >
                Previous
              </Link>
            ) : hasFilters ? (
              <Link href={clearFiltersHref} style={{ fontSize: "0.875rem" }}>
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
                  <th style={thStyle}>Public ID</th>
                  <th style={thStyle}>Record label</th>
                  <th style={thStyle}>Category</th>
                  <th style={thStyle}>Severity</th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <RecordRow key={record.id} record={record} projectId={project.id} />
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
              Showing {query.offset + 1}–{query.offset + records.length}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
              <PageSizeSelect
                value={query.pageSize}
                hrefBySize={buildHrefBySize((pageSize) =>
                  buildChangeCenterHref(query, { pageSize }),
                )}
              />
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {query.offset > 0 ? (
                  <Link
                    href={buildChangeCenterHref(query, {
                      offset: Math.max(0, query.offset - query.pageSize),
                    })}
                  >
                    Previous
                  </Link>
                ) : null}
                {hasNextPage ? (
                  <Link
                    href={buildChangeCenterHref(query, { offset: query.offset + query.pageSize })}
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
const labelStyle = {
  fontSize: "0.75rem",
  color: "var(--webdesk-dashboard-color-foreground-muted)",
} as const;

function TextFilter({
  label,
  name,
  value,
}: {
  readonly label: string;
  readonly name: string;
  readonly value: string | null;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      <span style={labelStyle}>{label}</span>
      <input
        key={value ?? `no-${name}`}
        type="text"
        name={name}
        defaultValue={value ?? ""}
        maxLength={255}
        style={selectStyle}
      />
    </label>
  );
}

function RecordRow({
  record,
  projectId,
}: {
  readonly record: ChangeRecord;
  readonly projectId: string;
}) {
  const statusBadge = changeRecordStatusBadge(record.status);
  const severityBadge = changeRecordSeverityBadge(record.severity);
  return (
    <tr>
      <td
        style={{
          ...tdStyle,
          fontFamily: typographyTokens.fontFamilyMono,
          color: "var(--webdesk-dashboard-color-foreground-muted)",
        }}
      >
        <Link href={withProjectId(`/change-center/${record.id}`, projectId)}>
          {record.publicId}
        </Link>
      </td>
      <td style={tdStyle}>{record.recordLabel}</td>
      <td style={{ ...tdStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
        {CATEGORY_LABEL[record.category]}
      </td>
      <td style={tdStyle}>
        <StatusBadge status={severityBadge.token} label={severityBadge.label} />
      </td>
      <td style={tdStyle}>
        <StatusBadge status={statusBadge.token} label={statusBadge.label} />
      </td>
    </tr>
  );
}
