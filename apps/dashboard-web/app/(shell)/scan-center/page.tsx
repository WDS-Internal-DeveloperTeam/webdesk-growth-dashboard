import { cookies } from "next/headers";
import Link from "next/link";
import type { ScanDefinition } from "@webdesk/shared-types";
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
import { tolerateDiscard } from "@/lib/business-knowledge";
import { CURRENT_PROJECT_COOKIE } from "@/lib/current-project";
import {
  filterSelectStyle as selectStyle,
  filterSubmitButtonStyle as submitButtonStyle,
} from "@/lib/list-filter-styles";
import { listTableCellStyle, listTableHeaderCellStyle } from "@/lib/list-table-styles";
import { buildHrefBySize } from "@/lib/pagination";
import { getProject, getProjects } from "@/lib/projects";
import {
  buildScanDefinitionsHref,
  getScanDefinitions,
  parseScanDefinitionsSearchParams,
  SCAN_TYPE_LABEL,
  SCAN_TYPE_VALUES,
  withProjectId,
} from "@/lib/scan-center";
import { firstValue } from "@/lib/search-params";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface ScanCenterListPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Unlike every organization-wide content-library module, Scan Center is genuinely project-scoped
 * (`scan-center/projects/:projectId/definitions`), same shape as Page Inventory/Keyword & Entity
 * Library/Internal Linking Library — this list page is where a project must first be resolved.
 * `?projectId=` is the source of truth throughout this module (matching every other project-scoped
 * module's own established convention): the header Project Switcher's `wds_current_project`
 * cookie stays purely advisory, only used here to PRE-SELECT the picker's default option, never to
 * bypass it. When `?projectId=` is missing or doesn't resolve to a real project, this page renders
 * a project-picker prompt instead of a table.
 *
 * No approved wireframe exists for this module — the list page renders exactly what
 * `GET .../definitions` returns and supports (`scanType`/`isEnabled`/`search` filters), the
 * smallest honest reading of the backend's actual field set, matching every sibling module's own
 * precedent for an unsourced screen. `mode`/`environment`/`scheduleCron` aren't shown as columns —
 * no wireframe names them, and the detail page is one click away.
 */
export default async function ScanCenterListPage({ searchParams }: ScanCenterListPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const rawParams = await searchParams;
  const projectIdParam = firstValue(rawParams.projectId);

  // Fired concurrently with the project-existence check below, not sequentially after it —
  // matches `PageInventoryListPage`'s own established pattern. `tolerateDiscard()` avoids an
  // unhandled-rejection warning on the branch where `project` turns out null and this promise is
  // never awaited.
  const definitionsPromise = projectIdParam
    ? tolerateDiscard(
        getScanDefinitions(parseScanDefinitionsSearchParams(projectIdParam, rawParams)),
      )
    : null;

  const project = projectIdParam ? await getProject(projectIdParam) : null;

  if (!project) {
    const cookieStore = await cookies();
    const defaultProjectId = cookieStore.get(CURRENT_PROJECT_COOKIE)?.value ?? null;
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
        <PageHeader title="Scan Center" />
        {projects.length === 0 ? (
          <EmptyState
            title="No projects yet"
            description="Scan Center is scoped to a project — create a project first."
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
            submitLabel="View scan definitions"
          />
        )}
      </ContentContainer>
    );
  }

  const query = parseScanDefinitionsSearchParams(project.id, rawParams);
  const { items: definitions, hasNextPage } = await definitionsPromise!;
  const hasFilters = query.scanType !== null || query.isEnabled !== null;
  const isPastLastPage = definitions.length === 0 && query.offset > 0;
  const clearFiltersHref = withProjectId("/scan-center", project.id);

  return (
    <ContentContainer>
      <PageHeader
        title={`Scan Center — ${project.name}`}
        contextActions={
          <>
            <Link href={clearFiltersHref} style={{ fontSize: "0.875rem" }}>
              Switch project
            </Link>
            <Link
              href={withProjectId("/scan-center/definitions/new", project.id)}
              style={primaryActionLinkStyle}
            >
              New definition
            </Link>
          </>
        }
      />

      <form
        method="get"
        style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.5rem" }}
      >
        <input type="hidden" name="projectId" value={project.id} />
        <input type="hidden" name="pageSize" value={query.pageSize} />
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span style={labelStyle}>Scan type</span>
          <select
            key={query.scanType ?? "all-scan-types"}
            name="scanType"
            defaultValue={query.scanType ?? ""}
            style={selectStyle}
          >
            <option value="">All scan types</option>
            {SCAN_TYPE_VALUES.map((value) => (
              <option key={value} value={value}>
                {SCAN_TYPE_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span style={labelStyle}>Enabled</span>
          <select
            key={query.isEnabled === null ? "all" : String(query.isEnabled)}
            name="isEnabled"
            defaultValue={query.isEnabled === null ? "" : String(query.isEnabled)}
            style={selectStyle}
          >
            <option value="">All</option>
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span style={labelStyle}>Search</span>
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
            href={clearFiltersHref}
            style={{ alignSelf: "flex-end", fontSize: "0.875rem", padding: "0.4rem 0" }}
          >
            Clear filters
          </Link>
        ) : null}
      </form>

      {definitions.length === 0 ? (
        <EmptyState
          title={
            isPastLastPage
              ? "No more scan definitions"
              : hasFilters || query.search
                ? "No scan definitions match your filters"
                : "No scan definitions yet"
          }
          description={
            isPastLastPage
              ? "You've gone past the last page of results."
              : hasFilters || query.search
                ? "Try a different type, status, or search term."
                : "Scan definitions created for this project will appear here."
          }
          action={
            isPastLastPage ? (
              <Link
                href={buildScanDefinitionsHref(query, {
                  offset: Math.max(0, query.offset - query.pageSize),
                })}
                style={{ fontSize: "0.875rem" }}
              >
                Previous
              </Link>
            ) : hasFilters || query.search ? (
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
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Mode</th>
                  <th style={thStyle}>Enabled</th>
                </tr>
              </thead>
              <tbody>
                {definitions.map((definition) => (
                  <DefinitionRow
                    key={definition.id}
                    definition={definition}
                    projectId={project.id}
                  />
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
              Showing {query.offset + 1}–{query.offset + definitions.length}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
              <PageSizeSelect
                value={query.pageSize}
                hrefBySize={buildHrefBySize((pageSize) =>
                  buildScanDefinitionsHref(query, { pageSize }),
                )}
              />
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {query.offset > 0 ? (
                  <Link
                    href={buildScanDefinitionsHref(query, {
                      offset: Math.max(0, query.offset - query.pageSize),
                    })}
                  >
                    Previous
                  </Link>
                ) : null}
                {hasNextPage ? (
                  <Link
                    href={buildScanDefinitionsHref(query, {
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
const labelStyle = {
  fontSize: "0.75rem",
  color: "var(--webdesk-dashboard-color-foreground-muted)",
} as const;

function DefinitionRow({
  definition,
  projectId,
}: {
  readonly definition: ScanDefinition;
  readonly projectId: string;
}) {
  return (
    <tr>
      <td
        style={{
          ...tdStyle,
          fontFamily: typographyTokens.fontFamilyMono,
          color: "var(--webdesk-dashboard-color-foreground-muted)",
        }}
      >
        {definition.publicId}
      </td>
      <td style={tdStyle}>
        <Link href={withProjectId(`/scan-center/definitions/${definition.id}`, projectId)}>
          {definition.name}
        </Link>
      </td>
      <td style={{ ...tdStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
        {SCAN_TYPE_LABEL[definition.scanType]}
      </td>
      <td style={{ ...tdStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
        {definition.mode === "scheduled" ? "Scheduled" : "Manual"}
      </td>
      <td style={tdStyle}>
        {definition.isEnabled ? (
          <StatusBadge status="healthy" label="Enabled" />
        ) : (
          <StatusBadge status="notConfigured" label="Disabled" />
        )}
      </td>
    </tr>
  );
}
