import Link from "next/link";
import type { Project } from "@webdesk/shared-types";
import { ContentContainer, EmptyState, PageHeader, StatusBadge } from "@webdesk/ui";
import { getServerSession } from "@/lib/server-session";
import {
  buildProjectsHref,
  getProjects,
  parseProjectsSearchParams,
  PROJECTS_PAGE_SIZE,
  projectStatusBadge,
  type ProjectSortBy,
  type ProjectsQuery,
} from "@/lib/projects";

export const dynamic = "force-dynamic";

interface ProjectsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const COLUMN_LABELS: Readonly<Record<ProjectSortBy, string>> = {
  name: "Name",
  status: "Status",
  createdAt: "Created",
  updatedAt: "Updated",
};

/** No approved wireframe exists for a Projects list screen (only the shell nav item and header
 *  Project Switcher are sourced — see `docs/task-packages/module-projects-foundation.md` §8's own
 *  "not sourced, confirm or correct" note). This renders exactly what `GET /projects` actually
 *  returns and supports (name/status/search/sort/pagination) — no invented columns, no links to
 *  a project-detail page that doesn't exist yet. */
export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  // The (shell) layout already redirects unauthenticated callers to sign-in before this page
  // renders — this is a defensive fallback (same pattern as home/page.tsx), not the real guard.
  // Without it, an unauthenticated request still fires getProjects() below in parallel with the
  // layout's own redirect check, wasting a call to dashboard-api that's discarded either way.
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const query = parseProjectsSearchParams(await searchParams);
  const projects = await getProjects(query);
  const hasFilters = query.search !== null || query.status !== null;

  return (
    <ContentContainer>
      <PageHeader title="Projects" />

      <form
        method="get"
        style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.5rem" }}
      >
        <input type="hidden" name="sortBy" value={query.sortBy} />
        <input type="hidden" name="sortOrder" value={query.sortOrder} />
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
            type="text"
            name="search"
            defaultValue={query.search ?? ""}
            placeholder="Project name"
            style={{
              padding: "0.4rem 0.6rem",
              border: "1px solid var(--webdesk-dashboard-color-border)",
              borderRadius: "0.25rem",
              fontSize: "0.875rem",
              minWidth: "16rem",
            }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span
            style={{
              fontSize: "0.75rem",
              color: "var(--webdesk-dashboard-color-foreground-muted)",
            }}
          >
            Status
          </span>
          <select
            name="status"
            defaultValue={query.status ?? ""}
            style={{
              padding: "0.4rem 0.6rem",
              border: "1px solid var(--webdesk-dashboard-color-border)",
              borderRadius: "0.25rem",
              fontSize: "0.875rem",
            }}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <button
          type="submit"
          style={{
            alignSelf: "flex-end",
            padding: "0.4rem 0.9rem",
            border: "1px solid var(--webdesk-dashboard-color-border)",
            borderRadius: "0.25rem",
            background: "var(--webdesk-dashboard-color-surface)",
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        >
          Apply
        </button>
        {hasFilters ? (
          <Link
            href="/projects"
            style={{ alignSelf: "flex-end", fontSize: "0.875rem", padding: "0.4rem 0" }}
          >
            Clear filters
          </Link>
        ) : null}
      </form>

      {projects.length === 0 ? (
        <EmptyState
          title={hasFilters ? "No projects match your filters" : "No projects yet"}
          description={
            hasFilters
              ? "Try a different search term or status."
              : "Projects created for this organization will appear here."
          }
          action={
            hasFilters ? (
              <Link href="/projects" style={{ fontSize: "0.875rem" }}>
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
                  {(["name", "status"] as const).map((column) => (
                    <SortableHeader key={column} column={column} query={query} />
                  ))}
                  <th style={thStyle}>Public ID</th>
                  <SortableHeader column="updatedAt" query={query} />
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <ProjectRow key={project.id} project={project} />
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
              Showing {query.offset + 1}–{query.offset + projects.length}
            </span>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              {query.offset > 0 ? (
                <Link
                  href={buildProjectsHref(query, {
                    offset: Math.max(0, query.offset - PROJECTS_PAGE_SIZE),
                  })}
                >
                  Previous
                </Link>
              ) : null}
              {projects.length === PROJECTS_PAGE_SIZE ? (
                <Link
                  href={buildProjectsHref(query, { offset: query.offset + PROJECTS_PAGE_SIZE })}
                >
                  Next
                </Link>
              ) : null}
            </div>
          </div>
        </>
      )}
    </ContentContainer>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "0.6rem 0.75rem",
  borderBottom: "1px solid var(--webdesk-dashboard-color-border)",
  fontSize: "0.75rem",
  color: "var(--webdesk-dashboard-color-foreground-subtle)",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const tdStyle: React.CSSProperties = {
  padding: "0.6rem 0.75rem",
  borderBottom: "1px solid var(--webdesk-dashboard-color-border)",
  verticalAlign: "middle",
};

function SortableHeader({
  column,
  query,
}: {
  readonly column: ProjectSortBy;
  readonly query: ProjectsQuery;
}) {
  const isActive = query.sortBy === column;
  const nextOrder = isActive && query.sortOrder === "ASC" ? "DESC" : "ASC";
  return (
    <th style={thStyle}>
      <Link
        href={buildProjectsHref(query, { sortBy: column, sortOrder: nextOrder })}
        style={{ color: "inherit", textDecoration: "none" }}
      >
        {COLUMN_LABELS[column]}
        {isActive ? (query.sortOrder === "ASC" ? " ▲" : " ▼") : ""}
      </Link>
    </th>
  );
}

function formatTimestamp(iso: string): string {
  // Displayed as the raw stored UTC timestamp, not localized — real timezone confirmation is
  // still an open item (CLAUDE.md's "Open client blockers"), so this doesn't invent a conversion.
  return `${iso.slice(0, 16).replace("T", " ")} UTC`;
}

function ProjectRow({ project }: { readonly project: Project }) {
  const badge = projectStatusBadge(project.status);
  return (
    <tr>
      <td style={tdStyle}>{project.name}</td>
      <td style={tdStyle}>
        <StatusBadge status={badge.token} label={badge.label} />
      </td>
      <td
        style={{
          ...tdStyle,
          fontFamily:
            "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
          color: "var(--webdesk-dashboard-color-foreground-muted)",
        }}
      >
        {project.publicId}
      </td>
      <td style={{ ...tdStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
        {formatTimestamp(project.updatedAt)}
      </td>
    </tr>
  );
}
