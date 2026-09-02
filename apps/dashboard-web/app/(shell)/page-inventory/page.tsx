import { cookies } from "next/headers";
import Link from "next/link";
import type { Page as InventoryPage } from "@webdesk/shared-types";
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
import { ARTIFACT_APPROVAL_STATUS_VALUES } from "@/lib/artifact-approval-status";
import { tolerateDiscard } from "@/lib/business-knowledge";
import { CURRENT_PROJECT_COOKIE } from "@/lib/current-project";
import {
  filterSelectStyle as selectStyle,
  filterSubmitButtonStyle as submitButtonStyle,
} from "@/lib/list-filter-styles";
import { listTableCellStyle, listTableHeaderCellStyle } from "@/lib/list-table-styles";
import { buildHrefBySize } from "@/lib/pagination";
import {
  buildPageInventoryHref,
  getPages,
  pageWorkflowStageBadge,
  parsePageInventorySearchParams,
  withProjectId,
} from "@/lib/page-inventory";
import {
  INDEX_STATUS_LABEL,
  INDEX_STATUS_VALUES,
  WORKFLOW_STAGE_LABEL,
} from "@/lib/page-inventory-query";
import { getProject, getProjects } from "@/lib/projects";
import { firstValue } from "@/lib/search-params";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface PageInventoryListPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Unlike every other module built so far, Page Inventory is genuinely project-scoped
 * (`page-inventory/projects/:projectId/pages`) — this list page is the one place in the app that
 * has to establish which project before it can render anything else. An explicit `?projectId=`
 * wins when present; otherwise the header Project Switcher's `wds_current_project` cookie is used
 * directly (its own `router.refresh()` on change keeps this page current live, per 2026-09-02's
 * fix closing the "current project" propagation gap — no more per-page picker step duplicating the
 * header). Only when NEITHER resolves to a real project (`getProject()` returns `null` for both a
 * malformed id and a genuine 404 — the same "smallest honest reading" contract every sibling
 * detail fetch already uses) does this page render a project-picker prompt instead of a table.
 *
 * Once a project is resolved, renders exactly what `GET .../pages` returns and supports — the
 * filters the backend's own `listPagesQuerySchema` accepts (search/pageType/workflowStage/
 * indexStatus/template/targetKeyword/last-scan/last-deployment date ranges), and the wireframe's
 * own column list (`07_Low_Fidelity_Wireframes.md §2`) minus "Owner" (no backing column) and "URL"
 * (no join — `PageEntity` itself carries no `url` field; showing one would mean an N+1 fetch per
 * row, an anti-pattern this app has never used for a list page) and minus "Existing/New" (the
 * backend's own query schema has no filter for it).
 */
export default async function PageInventoryListPage({ searchParams }: PageInventoryListPageProps) {
  // The (shell) layout already redirects unauthenticated callers to sign-in before this page
  // renders — this defensive fallback avoids firing any fetch in parallel with a redirect that
  // would just discard the result, matching every other page in this app.
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const rawParams = await searchParams;
  const projectIdParam = firstValue(rawParams.projectId);
  // The header Project Switcher's cookie is now the real fallback source of truth, not just a
  // picker pre-fill — an explicit `?projectId=` still overrides it.
  const cookieStore = await cookies();
  const defaultProjectId = cookieStore.get(CURRENT_PROJECT_COOKIE)?.value ?? null;
  const effectiveProjectId = projectIdParam ?? defaultProjectId;

  // Fired concurrently with the project-existence check below, not sequentially after it
  // (code-review finding, `dashboard-web-page-inventory`) — `getPages()` only needs the raw
  // `projectId` string, not any field resolved from the `Project` entity itself.
  // `parsePageInventorySearchParams()` is pure/synchronous, so calling it again below (once
  // `project.id` is confirmed) is free — this keeps `query`'s type non-nullable there rather than
  // threading a nullable value through every later reference. `tolerateDiscard()` avoids an
  // unhandled-rejection warning on the branch where `project` turns out null and this promise is
  // never awaited (the project-picker prompt renders instead, needing its own `getProjects()` call).
  const pagesPromise = effectiveProjectId
    ? tolerateDiscard(getPages(parsePageInventorySearchParams(effectiveProjectId, rawParams)))
    : null;

  const project = effectiveProjectId ? await getProject(effectiveProjectId) : null;

  if (!project) {
    // Largest real page-size option (100) — the same bound every other picker in this app accepts
    // (`getServicesForPersonaPicker()`), not fixed in this pass. Sorted by name for a scannable
    // picker, unlike the Projects list page's own default `updatedAt`/`DESC` sort.
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
        <PageHeader title="Page Inventory" />
        {projects.length === 0 ? (
          <EmptyState
            title="No projects yet"
            description="Page Inventory is scoped to a project — create a project first."
            action={
              <Link href="/projects/new" style={{ fontSize: "0.875rem" }}>
                New project
              </Link>
            }
          />
        ) : (
          <ProjectPickerForm projects={projects} defaultProjectId={defaultProjectId} />
        )}
      </ContentContainer>
    );
  }

  const query = parsePageInventorySearchParams(project.id, rawParams);
  const { items: pages, hasNextPage } = await pagesPromise!;
  const hasFilters =
    query.pageType !== null ||
    query.workflowStage !== null ||
    query.indexStatus !== null ||
    query.template !== null ||
    query.targetKeyword !== null ||
    query.roadmapPhaseId !== null ||
    query.lastScanBefore !== null ||
    query.lastScanAfter !== null ||
    query.lastDeploymentBefore !== null ||
    query.lastDeploymentAfter !== null;
  const isPastLastPage = pages.length === 0 && query.offset > 0;
  const clearFiltersHref = withProjectId("/page-inventory", project.id);

  return (
    <ContentContainer>
      <PageHeader
        title={`Page Inventory — ${project.name}`}
        contextActions={
          <>
            <Link
              href={withProjectId("/page-inventory/new", project.id)}
              style={primaryActionLinkStyle}
            >
              New page
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
        <TextFilter label="Page type" name="pageType" value={query.pageType} />
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span style={labelStyle}>Workflow stage</span>
          <select
            key={query.workflowStage ?? "all-stages"}
            name="workflowStage"
            defaultValue={query.workflowStage ?? ""}
            style={selectStyle}
          >
            <option value="">All stages</option>
            {ARTIFACT_APPROVAL_STATUS_VALUES.map((value) => (
              <option key={value} value={value}>
                {WORKFLOW_STAGE_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span style={labelStyle}>Index status</span>
          <select
            key={query.indexStatus ?? "all-index-statuses"}
            name="indexStatus"
            defaultValue={query.indexStatus ?? ""}
            style={selectStyle}
          >
            <option value="">All index statuses</option>
            {INDEX_STATUS_VALUES.map((value) => (
              <option key={value} value={value}>
                {INDEX_STATUS_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
        <TextFilter label="Template" name="template" value={query.template} />
        <TextFilter label="Search" name="search" value={query.search} />
        <TextFilter label="Target keyword" name="targetKeyword" value={query.targetKeyword} />
        {/* No name-resolution endpoint exists for roadmap_items — a raw-id text input, same
            "no picker" convention the create/edit form's own roadmapPhaseId field already uses
            (code-review finding: this filter was previously omitted entirely, despite the backend
            genuinely supporting it). */}
        <TextFilter label="Roadmap phase ID" name="roadmapPhaseId" value={query.roadmapPhaseId} />
        <DateFilter label="Scanned after" name="lastScanAfter" value={query.lastScanAfter} />
        <DateFilter label="Scanned before" name="lastScanBefore" value={query.lastScanBefore} />
        <DateFilter
          label="Deployed after"
          name="lastDeploymentAfter"
          value={query.lastDeploymentAfter}
        />
        <DateFilter
          label="Deployed before"
          name="lastDeploymentBefore"
          value={query.lastDeploymentBefore}
        />
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

      {pages.length === 0 ? (
        <EmptyState
          title={
            isPastLastPage
              ? "No more pages"
              : hasFilters || query.search
                ? "No pages match your filters"
                : "No pages yet"
          }
          description={
            isPastLastPage
              ? "You've gone past the last page of results."
              : hasFilters || query.search
                ? "Try a different type, stage, status, or search term."
                : "Pages created for this project will appear here."
          }
          action={
            isPastLastPage ? (
              <Link
                href={buildPageInventoryHref(query, {
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
                  <th style={thStyle}>Page</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Stage</th>
                  <th style={thStyle}>Keyword</th>
                  <th style={thStyle}>Template</th>
                  <th style={thStyle}>Scan</th>
                  <th style={thStyle}>Release</th>
                </tr>
              </thead>
              <tbody>
                {pages.map((page) => (
                  <PageRow key={page.id} page={page} projectId={project.id} />
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
              Showing {query.offset + 1}–{query.offset + pages.length}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
              <PageSizeSelect
                value={query.pageSize}
                hrefBySize={buildHrefBySize((pageSize) =>
                  buildPageInventoryHref(query, { pageSize }),
                )}
              />
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {query.offset > 0 ? (
                  <Link
                    href={buildPageInventoryHref(query, {
                      offset: Math.max(0, query.offset - query.pageSize),
                    })}
                  >
                    Previous
                  </Link>
                ) : null}
                {hasNextPage ? (
                  <Link
                    href={buildPageInventoryHref(query, { offset: query.offset + query.pageSize })}
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

function DateFilter({
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
        type="date"
        name={name}
        defaultValue={value ?? ""}
        style={selectStyle}
      />
    </label>
  );
}

function PageRow({
  page,
  projectId,
}: {
  readonly page: InventoryPage;
  readonly projectId: string;
}) {
  const badge = pageWorkflowStageBadge(page.workflowStage);
  return (
    <tr>
      <td
        style={{
          ...tdStyle,
          fontFamily: typographyTokens.fontFamilyMono,
          color: "var(--webdesk-dashboard-color-foreground-muted)",
        }}
      >
        {page.publicId}
      </td>
      <td style={tdStyle}>
        <Link href={withProjectId(`/page-inventory/${page.id}`, projectId)}>{page.pageName}</Link>
      </td>
      <td style={{ ...tdStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
        {page.pageType ?? "—"}
      </td>
      <td style={tdStyle}>
        <StatusBadge status={badge.token} label={badge.label} />
      </td>
      <td style={{ ...tdStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
        {page.targetKeyword ?? "—"}
      </td>
      <td style={{ ...tdStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
        {page.template ?? "—"}
      </td>
      <td style={{ ...tdStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
        {page.lastScanAt ?? "—"}
      </td>
      <td style={{ ...tdStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
        {page.lastDeploymentAt ?? "—"}
      </td>
    </tr>
  );
}
