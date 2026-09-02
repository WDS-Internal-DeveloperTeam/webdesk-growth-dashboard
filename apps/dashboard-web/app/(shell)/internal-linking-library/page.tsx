import { cookies } from "next/headers";
import Link from "next/link";
import type { InternalLink } from "@webdesk/shared-types";
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
  buildInternalLinkLibraryHref,
  getInternalLinks,
  internalLinkPriorityBadge,
  internalLinkStatusBadge,
  parseInternalLinkLibrarySearchParams,
  PRIORITY_LABEL,
  STATUS_LABEL,
  withProjectId,
} from "@/lib/internal-linking-library";
import { PRIORITY_VALUES, STATUS_VALUES } from "@/lib/internal-linking-library-query";
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

interface InternalLinkLibraryListPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Internal links are project-scoped (`internal-linking-library/projects/:projectId/links`), same
 * pattern as Page Inventory/Keyword & Entity Library. An explicit `?projectId=` wins when present;
 * otherwise the header Project Switcher's `wds_current_project` cookie is used directly (its own
 * `router.refresh()` on change keeps this page current live, per 2026-09-02's fix closing the
 * "current project" propagation gap — no more per-page picker step duplicating the header). Only
 * when NEITHER resolves to a real project does this page fall back to a project-picker prompt.
 *
 * Once a project is resolved, renders exactly what `GET .../links` returns and supports — the
 * filters the backend's own `listInternalLinksQuerySchema` accepts (`sourcePageId`/`targetPageId`/
 * `status`/`priority`/`linkType`/`search`). `sourcePageId`/`targetPageId` are raw uuid-shaped text
 * filters, not resolved pickers, matching Page Inventory's own `roadmapPhaseId` filter's identical
 * "no picker" precedent — no name-resolution endpoint is fetched for the filter bar itself.
 */
export default async function InternalLinkLibraryListPage({
  searchParams,
}: InternalLinkLibraryListPageProps) {
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

  // Fired concurrently with the project-existence check below, not sequentially after it —
  // getInternalLinks() only needs the raw projectId string, not any field resolved from the
  // Project entity itself, mirroring getPages()'s/getKeywords()'s own identical fix.
  // tolerateDiscard() avoids an unhandled-rejection warning on the branch where project turns out
  // null and this promise is never awaited.
  const linksPromise = effectiveProjectId
    ? tolerateDiscard(
        getInternalLinks(parseInternalLinkLibrarySearchParams(effectiveProjectId, rawParams)),
      )
    : null;

  const project = effectiveProjectId ? await getProject(effectiveProjectId) : null;

  if (!project) {
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
        <PageHeader title="Internal Linking Library" />
        {projects.length === 0 ? (
          <EmptyState
            title="No projects yet"
            description="The Internal Linking Library is scoped to a project — create a project first."
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
            submitLabel="View links"
          />
        )}
      </ContentContainer>
    );
  }

  const query = parseInternalLinkLibrarySearchParams(project.id, rawParams);
  const { items: links, hasNextPage } = await linksPromise!;
  const hasFilters =
    query.sourcePageId !== null ||
    query.targetPageId !== null ||
    query.status !== null ||
    query.priority !== null ||
    query.linkType !== null;
  const isPastLastPage = links.length === 0 && query.offset > 0;
  const clearFiltersHref = withProjectId("/internal-linking-library", project.id);

  return (
    <ContentContainer>
      <PageHeader
        title={`Internal Linking Library — ${project.name}`}
        contextActions={
          <>
            <Link
              href={withProjectId("/internal-linking-library/new", project.id)}
              style={primaryActionLinkStyle}
            >
              New link
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
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span style={labelStyle}>Priority</span>
          <select
            key={query.priority ?? "all-priorities"}
            name="priority"
            defaultValue={query.priority ?? ""}
            style={selectStyle}
          >
            <option value="">All priorities</option>
            {PRIORITY_VALUES.map((value) => (
              <option key={value} value={value}>
                {PRIORITY_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
        <TextFilter label="Link type" name="linkType" value={query.linkType} />
        <TextFilter label="Search" name="search" value={query.search} />
        {/* No name-resolution endpoint is fetched for the filter bar — raw-id text inputs, same
            "no picker" convention Page Inventory's own roadmapPhaseId filter already uses. */}
        <TextFilter label="Source page ID" name="sourcePageId" value={query.sourcePageId} />
        <TextFilter label="Target page ID" name="targetPageId" value={query.targetPageId} />
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

      {links.length === 0 ? (
        <EmptyState
          title={
            isPastLastPage
              ? "No more links"
              : hasFilters || query.search
                ? "No links match your filters"
                : "No links yet"
          }
          description={
            isPastLastPage
              ? "You've gone past the last page of results."
              : hasFilters || query.search
                ? "Try a different status, priority, type, or search term."
                : "Internal links created for this project will appear here."
          }
          action={
            isPastLastPage ? (
              <Link
                href={buildInternalLinkLibraryHref(query, {
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
                  <th style={thStyle}>Relationship</th>
                  <th style={thStyle}>Anchor</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Priority</th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {links.map((link) => (
                  <LinkRow key={link.id} link={link} projectId={project.id} />
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
              Showing {query.offset + 1}–{query.offset + links.length}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
              <PageSizeSelect
                value={query.pageSize}
                hrefBySize={buildHrefBySize((pageSize) =>
                  buildInternalLinkLibraryHref(query, { pageSize }),
                )}
              />
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {query.offset > 0 ? (
                  <Link
                    href={buildInternalLinkLibraryHref(query, {
                      offset: Math.max(0, query.offset - query.pageSize),
                    })}
                  >
                    Previous
                  </Link>
                ) : null}
                {hasNextPage ? (
                  <Link
                    href={buildInternalLinkLibraryHref(query, {
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

function LinkRow({ link, projectId }: { readonly link: InternalLink; readonly projectId: string }) {
  const badge = internalLinkStatusBadge(link.status);
  return (
    <tr>
      <td
        style={{
          ...tdStyle,
          fontFamily: typographyTokens.fontFamilyMono,
          color: "var(--webdesk-dashboard-color-foreground-muted)",
        }}
      >
        <Link href={withProjectId(`/internal-linking-library/${link.id}`, projectId)}>
          {link.publicId}
        </Link>
      </td>
      <td style={{ ...tdStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
        {link.relationship ?? "—"}
      </td>
      <td style={{ ...tdStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
        {link.anchor ?? "—"}
      </td>
      <td style={{ ...tdStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
        {link.linkType ?? "—"}
      </td>
      <td style={{ ...tdStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
        {link.priority ? internalLinkPriorityBadge(link.priority).label : "—"}
      </td>
      <td style={tdStyle}>
        <StatusBadge status={badge.token} label={badge.label} />
      </td>
    </tr>
  );
}
