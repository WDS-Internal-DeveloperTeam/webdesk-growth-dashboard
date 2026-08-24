import { cookies } from "next/headers";
import Link from "next/link";
import type { EntityRecord } from "@webdesk/shared-types";
import { ContentContainer, EmptyState, PageHeader, typographyTokens } from "@webdesk/ui";
import { PageSizeSelect } from "@/components/page-size-select";
import { ProjectPickerForm } from "@/components/project-picker-form";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import { CURRENT_PROJECT_COOKIE } from "@/lib/current-project";
import {
  buildEntityLibraryHref,
  getEntities,
  parseEntityLibrarySearchParams,
  tolerateDiscard,
  withProjectId,
} from "@/lib/keyword-and-entity-library";
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

interface EntityLibraryListPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * The Keyword & Entity Library module's secondary record — a lightweight, project-scoped reference
 * list with no approval workflow of its own (task package D3), so this list page has no status
 * column/filter, unlike the keywords list page. Same `?projectId=`-is-the-source-of-truth
 * convention as every other route in this module (see the keywords list page's own top doc
 * comment).
 */
export default async function EntityLibraryListPage({
  searchParams,
}: EntityLibraryListPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const rawParams = await searchParams;
  const projectIdParam = firstValue(rawParams.projectId);

  const entitiesPromise = projectIdParam
    ? tolerateDiscard(getEntities(parseEntityLibrarySearchParams(projectIdParam, rawParams)))
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
        <PageHeader title="Entities" />
        {projects.length === 0 ? (
          <EmptyState
            title="No projects yet"
            description="Entities are scoped to a project — create a project first."
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
            submitLabel="View entities"
          />
        )}
      </ContentContainer>
    );
  }

  const query = parseEntityLibrarySearchParams(project.id, rawParams);
  const { items: entities, hasNextPage } = await entitiesPromise!;
  const hasFilters = query.entityType !== null;
  const isPastLastPage = entities.length === 0 && query.offset > 0;
  const clearFiltersHref = withProjectId("/keyword-and-entity-library/entities", project.id);

  return (
    <ContentContainer>
      <PageHeader
        title={`Entities — ${project.name}`}
        breadcrumbs={[
          { label: "Keyword & Entity Library", href: "/keyword-and-entity-library" },
          { label: "Entities" },
        ]}
        linkComponent={Link}
        contextActions={
          <>
            <Link href={clearFiltersHref} style={{ fontSize: "0.875rem" }}>
              Switch project
            </Link>
            <Link
              href={withProjectId("/keyword-and-entity-library/entities/new", project.id)}
              style={primaryActionLinkStyle}
            >
              New entity
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
          <span style={labelStyle}>Entity type</span>
          <input
            key={query.entityType ?? "no-entityType"}
            type="text"
            name="entityType"
            defaultValue={query.entityType ?? ""}
            maxLength={100}
            style={selectStyle}
          />
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

      {entities.length === 0 ? (
        <EmptyState
          title={
            isPastLastPage
              ? "No more entities"
              : hasFilters || query.search
                ? "No entities match your filters"
                : "No entities yet"
          }
          description={
            isPastLastPage
              ? "You've gone past the last page of results."
              : hasFilters || query.search
                ? "Try a different type or search term."
                : "Entities created for this project will appear here."
          }
          action={
            isPastLastPage ? (
              <Link
                href={buildEntityLibraryHref(query, {
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
                  <th style={thStyle}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {entities.map((entity) => (
                  <EntityRow key={entity.id} entity={entity} projectId={project.id} />
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
              Showing {query.offset + 1}–{query.offset + entities.length}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
              <PageSizeSelect
                value={query.pageSize}
                hrefBySize={buildHrefBySize((pageSize) =>
                  buildEntityLibraryHref(query, { pageSize }),
                )}
              />
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {query.offset > 0 ? (
                  <Link
                    href={buildEntityLibraryHref(query, {
                      offset: Math.max(0, query.offset - query.pageSize),
                    })}
                  >
                    Previous
                  </Link>
                ) : null}
                {hasNextPage ? (
                  <Link
                    href={buildEntityLibraryHref(query, { offset: query.offset + query.pageSize })}
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

function EntityRow({
  entity,
  projectId,
}: {
  readonly entity: EntityRecord;
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
        {entity.publicId}
      </td>
      <td style={tdStyle}>
        <Link href={withProjectId(`/keyword-and-entity-library/entities/${entity.id}`, projectId)}>
          {entity.name}
        </Link>
      </td>
      <td style={{ ...tdStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
        {entity.entityType ?? "—"}
      </td>
      <td style={{ ...tdStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
        {entity.updatedAt.slice(0, 10)}
      </td>
    </tr>
  );
}
