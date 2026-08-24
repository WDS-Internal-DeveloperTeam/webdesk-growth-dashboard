import { cookies } from "next/headers";
import Link from "next/link";
import type { Keyword } from "@webdesk/shared-types";
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
import { CURRENT_PROJECT_COOKIE } from "@/lib/current-project";
import {
  buildKeywordLibraryHref,
  getKeywords,
  keywordApprovalStatusBadge,
  parseKeywordLibrarySearchParams,
  tolerateDiscard,
  withProjectId,
} from "@/lib/keyword-and-entity-library";
import {
  APPROVAL_STATUS_LABEL,
  CONFIDENCE_LABEL,
  CONFIDENCE_VALUES,
} from "@/lib/keyword-and-entity-library-query";
import {
  filterSelectStyle as selectStyle,
  filterSubmitButtonStyle as submitButtonStyle,
} from "@/lib/list-filter-styles";
import { listTableCellStyle, listTableHeaderCellStyle } from "@/lib/list-table-styles";
import { buildHrefBySize } from "@/lib/pagination";
import { ARTIFACT_APPROVAL_STATUS_VALUES } from "@/lib/artifact-approval-status";
import { getProject, getProjects } from "@/lib/projects";
import { firstValue } from "@/lib/search-params";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface KeywordLibraryListPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Keywords is the module's own primary record (matching the seeded `module_registry.route`,
 * `/keyword-and-entity-library`) — Entities are a secondary, independently-browsable resource with
 * their own routes under `/keyword-and-entity-library/entities`. Like Page Inventory, this module
 * is genuinely project-scoped (`keyword-and-entity-library/projects/:projectId/keywords`) — this
 * list page is the one place that has to establish which project before it can render anything
 * else. `?projectId=` is the source of truth throughout this module, mirroring Page Inventory's own
 * already-confirmed convention: the header Project Switcher's `wds_current_project` cookie stays
 * purely advisory, only used here to pre-select the picker's default option.
 *
 * Renders exactly what `GET .../keywords` returns and supports — the filters the backend's own
 * `listKeywordsQuerySchema` accepts, and the columns named in the build instructions (query text,
 * type, intent, confidence, approval status, updated-at) — the smallest honest reading of an
 * unsourced screen, matching every sibling module's own precedent.
 */
export default async function KeywordLibraryListPage({
  searchParams,
}: KeywordLibraryListPageProps) {
  // The (shell) layout already redirects unauthenticated callers to sign-in before this page
  // renders — this defensive fallback avoids firing any fetch in parallel with a redirect that
  // would just discard the result, matching every other page in this app.
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const rawParams = await searchParams;
  const projectIdParam = firstValue(rawParams.projectId);

  // Fired concurrently with the project-existence check below, not sequentially after it,
  // matching Page Inventory's own fixed ordering (code-review finding, `dashboard-web-page-
  // inventory`) — `getKeywords()` only needs the raw `projectId` string, not any field resolved
  // from the `Project` entity itself. `tolerateDiscard()` avoids an unhandled-rejection warning on
  // the branch where `project` turns out null and this promise is never awaited.
  const keywordsPromise = projectIdParam
    ? tolerateDiscard(getKeywords(parseKeywordLibrarySearchParams(projectIdParam, rawParams)))
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
        <PageHeader title="Keyword & Entity Library" />
        {projects.length === 0 ? (
          <EmptyState
            title="No projects yet"
            description="Keyword & Entity Library is scoped to a project — create a project first."
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
            submitLabel="View keywords"
          />
        )}
      </ContentContainer>
    );
  }

  const query = parseKeywordLibrarySearchParams(project.id, rawParams);
  const { items: keywords, hasNextPage } = await keywordsPromise!;
  const hasFilters =
    query.keywordType !== null ||
    query.intent !== null ||
    query.funnelStage !== null ||
    query.country !== null ||
    query.confidence !== null ||
    query.approvalStatus !== null;
  const isPastLastPage = keywords.length === 0 && query.offset > 0;
  const clearFiltersHref = withProjectId("/keyword-and-entity-library", project.id);

  return (
    <ContentContainer>
      <PageHeader
        title={`Keyword & Entity Library — ${project.name}`}
        contextActions={
          <>
            <Link href={clearFiltersHref} style={{ fontSize: "0.875rem" }}>
              Switch project
            </Link>
            <Link
              href={withProjectId("/keyword-and-entity-library/entities", project.id)}
              style={{ fontSize: "0.875rem", alignSelf: "center" }}
            >
              View entities
            </Link>
            <Link
              href={withProjectId("/keyword-and-entity-library/new", project.id)}
              style={primaryActionLinkStyle}
            >
              New keyword
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
        <TextFilter
          label="Keyword type"
          name="keywordType"
          value={query.keywordType}
          maxLength={100}
        />
        <TextFilter label="Intent" name="intent" value={query.intent} maxLength={100} />
        <TextFilter
          label="Funnel stage"
          name="funnelStage"
          value={query.funnelStage}
          maxLength={100}
        />
        <TextFilter label="Country" name="country" value={query.country} maxLength={100} />
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span style={labelStyle}>Confidence</span>
          <select
            key={query.confidence ?? "all-confidence"}
            name="confidence"
            defaultValue={query.confidence ?? ""}
            style={selectStyle}
          >
            <option value="">All confidence levels</option>
            {CONFIDENCE_VALUES.map((value) => (
              <option key={value} value={value}>
                {CONFIDENCE_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span style={labelStyle}>Approval status</span>
          <select
            key={query.approvalStatus ?? "all-statuses"}
            name="approvalStatus"
            defaultValue={query.approvalStatus ?? ""}
            style={selectStyle}
          >
            <option value="">All statuses</option>
            {ARTIFACT_APPROVAL_STATUS_VALUES.map((value) => (
              <option key={value} value={value}>
                {APPROVAL_STATUS_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
        <TextFilter label="Search" name="search" value={query.search} />
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

      {keywords.length === 0 ? (
        <EmptyState
          title={
            isPastLastPage
              ? "No more keywords"
              : hasFilters || query.search
                ? "No keywords match your filters"
                : "No keywords yet"
          }
          description={
            isPastLastPage
              ? "You've gone past the last page of results."
              : hasFilters || query.search
                ? "Try a different type, intent, confidence, status, or search term."
                : "Keywords created for this project will appear here."
          }
          action={
            isPastLastPage ? (
              <Link
                href={buildKeywordLibraryHref(query, {
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
                  <th style={thStyle}>Query</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Intent</th>
                  <th style={thStyle}>Confidence</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {keywords.map((keyword) => (
                  <KeywordRow key={keyword.id} keyword={keyword} projectId={project.id} />
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
              Showing {query.offset + 1}–{query.offset + keywords.length}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
              <PageSizeSelect
                value={query.pageSize}
                hrefBySize={buildHrefBySize((pageSize) =>
                  buildKeywordLibraryHref(query, { pageSize }),
                )}
              />
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {query.offset > 0 ? (
                  <Link
                    href={buildKeywordLibraryHref(query, {
                      offset: Math.max(0, query.offset - query.pageSize),
                    })}
                  >
                    Previous
                  </Link>
                ) : null}
                {hasNextPage ? (
                  <Link
                    href={buildKeywordLibraryHref(query, { offset: query.offset + query.pageSize })}
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
  maxLength = 255,
}: {
  readonly label: string;
  readonly name: string;
  readonly value: string | null;
  /** Defaults to 255 (matches `search`'s backend limit); the 4 short-text filter fields
   *  (`keywordType`/`intent`/`funnelStage`/`country`) pass 100 explicitly to match
   *  `parseKeywordLibrarySearchParams`'s own `.slice(0, 100)` — without it, the input silently
   *  accepted up to 255 characters that the parser then truncated with no feedback shown
   *  (code-review finding, `dashboard-web-keyword-and-entity-library`). */
  readonly maxLength?: number;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      <span style={labelStyle}>{label}</span>
      <input
        key={value ?? `no-${name}`}
        type="text"
        name={name}
        defaultValue={value ?? ""}
        maxLength={maxLength}
        style={selectStyle}
      />
    </label>
  );
}

function KeywordRow({
  keyword,
  projectId,
}: {
  readonly keyword: Keyword;
  readonly projectId: string;
}) {
  const badge = keywordApprovalStatusBadge(keyword.approvalStatus);
  return (
    <tr>
      <td
        style={{
          ...tdStyle,
          fontFamily: typographyTokens.fontFamilyMono,
          color: "var(--webdesk-dashboard-color-foreground-muted)",
        }}
      >
        {keyword.publicId}
      </td>
      <td style={tdStyle}>
        <Link href={withProjectId(`/keyword-and-entity-library/${keyword.id}`, projectId)}>
          {keyword.queryText}
        </Link>
      </td>
      <td style={{ ...tdStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
        {keyword.keywordType ?? "—"}
      </td>
      <td style={{ ...tdStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
        {keyword.intent ?? "—"}
      </td>
      <td style={{ ...tdStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
        {keyword.confidence ? CONFIDENCE_LABEL[keyword.confidence] : "—"}
      </td>
      <td style={tdStyle}>
        <StatusBadge status={badge.token} label={badge.label} />
      </td>
      <td style={{ ...tdStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
        {keyword.updatedAt.slice(0, 10)}
      </td>
    </tr>
  );
}
