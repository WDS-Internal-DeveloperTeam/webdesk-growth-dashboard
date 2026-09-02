import { cookies } from "next/headers";
import Link from "next/link";
import type { TechnicalCheckDefinition } from "@webdesk/shared-types";
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
import { firstValue } from "@/lib/search-params";
import { getServerSession } from "@/lib/server-session";
import {
  buildTechnicalCheckDefinitionsHref,
  getTechnicalCheckDefinitions,
  parseTechnicalCheckDefinitionsSearchParams,
  TECHNICAL_CHECK_TYPE_LABEL,
  TECHNICAL_CHECK_TYPE_VALUES,
  withProjectId,
} from "@/lib/technical-center";

export const dynamic = "force-dynamic";

interface TechnicalCenterListPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Technical Center is project-scoped, mirroring `ScanCenterListPage`'s own exact shape — this list
 * page is where a project must first be resolved. An explicit `?projectId=` wins when present;
 * otherwise the header Project Switcher's `wds_current_project` cookie is used directly (its own
 * `router.refresh()` on change keeps this page current live, per 2026-09-02's fix closing the
 * "current project" propagation gap — no more per-page picker step duplicating the header). Only
 * when NEITHER resolves to a real project does this page fall back to a project-picker prompt.
 *
 * No approved wireframe exists for this module — the list page renders exactly what
 * `GET .../definitions` returns and supports (`checkType`/`isEnabled`/`search` filters), the
 * smallest honest reading of the backend's actual field set, matching every sibling module's own
 * precedent for an unsourced screen. `mode`/`environment`/`scheduleCron` aren't shown as columns —
 * no wireframe names them, and the detail page is one click away.
 */
export default async function TechnicalCenterListPage({
  searchParams,
}: TechnicalCenterListPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const rawParams = await searchParams;
  const projectIdParam = firstValue(rawParams.projectId);
  // The header Project Switcher's cookie is now the real fallback source of truth, not just a
  // picker pre-fill — an explicit `?projectId=` still overrides it. Closes the long-deferred
  // "current project" propagation gap: this list page no longer forces a picker step the header
  // already answered.
  const cookieStore = await cookies();
  const defaultProjectId = cookieStore.get(CURRENT_PROJECT_COOKIE)?.value ?? null;
  const effectiveProjectId = projectIdParam ?? defaultProjectId;

  // Fired concurrently with the project-existence check below, not sequentially after it —
  // matches `ScanCenterListPage`'s own established pattern. `tolerateDiscard()` avoids an
  // unhandled-rejection warning on the branch where `project` turns out null and this promise is
  // never awaited.
  const definitionsPromise = effectiveProjectId
    ? tolerateDiscard(
        getTechnicalCheckDefinitions(
          parseTechnicalCheckDefinitionsSearchParams(effectiveProjectId, rawParams),
        ),
      )
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
        <PageHeader title="Technical Center" />
        {projects.length === 0 ? (
          <EmptyState
            title="No projects yet"
            description="Technical Center is scoped to a project — create a project first."
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
            submitLabel="View technical check definitions"
          />
        )}
      </ContentContainer>
    );
  }

  const query = parseTechnicalCheckDefinitionsSearchParams(project.id, rawParams);
  const { items: definitions, hasNextPage } = await definitionsPromise!;
  const hasFilters = query.checkType !== null || query.isEnabled !== null;
  const isPastLastPage = definitions.length === 0 && query.offset > 0;
  const clearFiltersHref = withProjectId("/technical-center", project.id);

  return (
    <ContentContainer>
      <PageHeader
        title={`Technical Center — ${project.name}`}
        contextActions={
          <>
            <Link
              href={withProjectId("/technical-center/definitions/new", project.id)}
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
          <span style={labelStyle}>Check type</span>
          <select
            key={query.checkType ?? "all-check-types"}
            name="checkType"
            defaultValue={query.checkType ?? ""}
            style={selectStyle}
          >
            <option value="">All check types</option>
            {TECHNICAL_CHECK_TYPE_VALUES.map((value) => (
              <option key={value} value={value}>
                {TECHNICAL_CHECK_TYPE_LABEL[value]}
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
              ? "No more technical check definitions"
              : hasFilters || query.search
                ? "No technical check definitions match your filters"
                : "No technical check definitions yet"
          }
          description={
            isPastLastPage
              ? "You've gone past the last page of results."
              : hasFilters || query.search
                ? "Try a different type, status, or search term."
                : "Technical check definitions created for this project will appear here."
          }
          action={
            isPastLastPage ? (
              <Link
                href={buildTechnicalCheckDefinitionsHref(query, {
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
                  buildTechnicalCheckDefinitionsHref(query, { pageSize }),
                )}
              />
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {query.offset > 0 ? (
                  <Link
                    href={buildTechnicalCheckDefinitionsHref(query, {
                      offset: Math.max(0, query.offset - query.pageSize),
                    })}
                  >
                    Previous
                  </Link>
                ) : null}
                {hasNextPage ? (
                  <Link
                    href={buildTechnicalCheckDefinitionsHref(query, {
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
  readonly definition: TechnicalCheckDefinition;
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
        <Link href={withProjectId(`/technical-center/definitions/${definition.id}`, projectId)}>
          {definition.name}
        </Link>
      </td>
      <td style={{ ...tdStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
        {TECHNICAL_CHECK_TYPE_LABEL[definition.checkType]}
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
