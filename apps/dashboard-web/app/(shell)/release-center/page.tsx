import { cookies } from "next/headers";
import Link from "next/link";
import type { Release } from "@webdesk/shared-types";
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
  buildReleasesHref,
  getReleases,
  parseReleasesSearchParams,
  releaseStatusBadge,
  RELEASE_STATUS_LABEL,
  RELEASE_STATUS_VALUES,
  RELEASE_TYPE_LABEL,
  RELEASE_TYPE_VALUES,
  withProjectId,
} from "@/lib/release-center";
import { firstValue } from "@/lib/search-params";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface ReleaseCenterListPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Release Center is project-scoped, mirroring `TechnicalCenterListPage`'s/`ScanCenterListPage`'s
 * own exact shape — this list page is where a project must first be resolved. An explicit
 * `?projectId=` wins when present; otherwise the header Project Switcher's `wds_current_project`
 * cookie is used directly (its own `router.refresh()` on change keeps this page current live).
 * Only when NEITHER resolves to a real project does this page fall back to a project-picker
 * prompt.
 *
 * No approved wireframe exists for this module — the list page renders exactly what
 * `GET .../releases` returns and supports (`releaseType`/`status`/`search` filters), the smallest
 * honest reading of the backend's actual field set. `assignedDeveloperUserId`/
 * `assignedReviewerUserId` aren't shown as a resolved-name column here — resolving them for every
 * row would mean an N+1 `getUsersByIds()` fetch this list page's own row count doesn't
 * currently justify; the detail page is one click away and already resolves both.
 */
export default async function ReleaseCenterListPage({ searchParams }: ReleaseCenterListPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const rawParams = await searchParams;
  const projectIdParam = firstValue(rawParams.projectId);
  const cookieStore = await cookies();
  const defaultProjectId = cookieStore.get(CURRENT_PROJECT_COOKIE)?.value ?? null;
  const effectiveProjectId = projectIdParam ?? defaultProjectId;

  const releasesPromise = effectiveProjectId
    ? tolerateDiscard(getReleases(parseReleasesSearchParams(effectiveProjectId, rawParams)))
    : null;

  const project = effectiveProjectId ? await getProject(effectiveProjectId) : null;

  if (!project) {
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
        <PageHeader title="Release Center" />
        {projects.length === 0 ? (
          <EmptyState
            title="No projects yet"
            description="Release Center is scoped to a project — create a project first."
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
            submitLabel="View releases"
          />
        )}
      </ContentContainer>
    );
  }

  const query = parseReleasesSearchParams(project.id, rawParams);
  const { items: releases, hasNextPage } = await releasesPromise!;
  const hasFilters = query.releaseType !== null || query.status !== null;
  const isPastLastPage = releases.length === 0 && query.offset > 0;
  const clearFiltersHref = withProjectId("/release-center", project.id);

  return (
    <ContentContainer>
      <PageHeader
        title={`Release Center — ${project.name}`}
        contextActions={
          <Link
            href={withProjectId("/release-center/new", project.id)}
            style={primaryActionLinkStyle}
          >
            New release
          </Link>
        }
      />

      <form
        method="get"
        style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.5rem" }}
      >
        <input type="hidden" name="projectId" value={project.id} />
        <input type="hidden" name="pageSize" value={query.pageSize} />
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span style={labelStyle}>Release type</span>
          <select
            key={query.releaseType ?? "all-release-types"}
            name="releaseType"
            defaultValue={query.releaseType ?? ""}
            style={selectStyle}
          >
            <option value="">All release types</option>
            {RELEASE_TYPE_VALUES.map((value) => (
              <option key={value} value={value}>
                {RELEASE_TYPE_LABEL[value]}
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
            {RELEASE_STATUS_VALUES.map((value) => (
              <option key={value} value={value}>
                {RELEASE_STATUS_LABEL[value]}
              </option>
            ))}
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

      {releases.length === 0 ? (
        <EmptyState
          title={
            isPastLastPage
              ? "No more releases"
              : hasFilters || query.search
                ? "No releases match your filters"
                : "No releases yet"
          }
          description={
            isPastLastPage
              ? "You've gone past the last page of results."
              : hasFilters || query.search
                ? "Try a different type, status, or search term."
                : "Releases created for this project will appear here."
          }
          action={
            isPastLastPage ? (
              <Link
                href={buildReleasesHref(query, {
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
                  <th style={thStyle}>Title</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {releases.map((release) => (
                  <ReleaseRow key={release.id} release={release} projectId={project.id} />
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
              Showing {query.offset + 1}–{query.offset + releases.length}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
              <PageSizeSelect
                value={query.pageSize}
                hrefBySize={buildHrefBySize((pageSize) => buildReleasesHref(query, { pageSize }))}
              />
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {query.offset > 0 ? (
                  <Link
                    href={buildReleasesHref(query, {
                      offset: Math.max(0, query.offset - query.pageSize),
                    })}
                  >
                    Previous
                  </Link>
                ) : null}
                {hasNextPage ? (
                  <Link href={buildReleasesHref(query, { offset: query.offset + query.pageSize })}>
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

function ReleaseRow({
  release,
  projectId,
}: {
  readonly release: Release;
  readonly projectId: string;
}) {
  const badge = releaseStatusBadge(release.status);
  return (
    <tr>
      <td
        style={{
          ...tdStyle,
          fontFamily: typographyTokens.fontFamilyMono,
          color: "var(--webdesk-dashboard-color-foreground-muted)",
        }}
      >
        {release.publicId}
      </td>
      <td style={tdStyle}>
        <Link href={withProjectId(`/release-center/${release.id}`, projectId)}>
          {release.title}
        </Link>
      </td>
      <td style={{ ...tdStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
        {RELEASE_TYPE_LABEL[release.releaseType]}
      </td>
      <td style={tdStyle}>
        <StatusBadge status={badge.token} label={badge.label} />
      </td>
    </tr>
  );
}

