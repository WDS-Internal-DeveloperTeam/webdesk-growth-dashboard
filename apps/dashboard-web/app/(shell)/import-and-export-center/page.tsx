import Link from "next/link";
import type { ImportTemplate, ModuleRegistrySummary } from "@webdesk/shared-types";
import { ContentContainer, EmptyState, PageHeader } from "@webdesk/ui";
import { PageSizeSelect } from "@/components/page-size-select";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import {
  buildImportTemplatesHref,
  formatTimestamp,
  getImportTemplates,
  IMPORT_EXPORT_FILE_FORMAT_LABEL,
  moduleDisplayName,
  parseImportTemplatesSearchParams,
  sortModulesForPicker,
} from "@/lib/import-and-export-center";
import {
  filterSelectStyle as selectStyle,
  filterSubmitButtonStyle as submitButtonStyle,
} from "@/lib/list-filter-styles";
import { listTableCellStyle, listTableHeaderCellStyle } from "@/lib/list-table-styles";
import { buildHrefBySize } from "@/lib/pagination";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface ImportAndExportCenterListPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const subNavLinkStyle = { fontSize: "0.875rem" } as const;
const subNavActiveStyle = { ...subNavLinkStyle, fontWeight: 600 } as const;

/**
 * The module's default/home view — the templates list. No approved wireframe exists for this
 * module — renders exactly what `GET .../templates` returns and supports
 * (`targetModuleKey`/`isActive`/`search` filters and offset pagination), matching every sibling
 * module's own "smallest honest reading" precedent for an unsourced screen. Organization-wide, not
 * project-scoped — no `projectId` anywhere, unlike Scan Center/Page Inventory.
 *
 * The `targetModuleKey` filter's own options come from the session's own already-fetched
 * `session.navigation`, mirroring `ReadyForClaudeQueueListPage`'s own identical reasoning
 * (`GET /authz/module-registry` is gated on a permission most roles lack).
 */
export default async function ImportAndExportCenterListPage({
  searchParams,
}: ImportAndExportCenterListPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const query = parseImportTemplatesSearchParams(await searchParams);
  const { items: templates, hasNextPage } = await getImportTemplates(query);
  const modules = sortModulesForPicker(session.navigation);

  const hasFilters = query.targetModuleKey !== null || query.isActive !== null;
  const isPastLastPage = templates.length === 0 && query.offset > 0;

  return (
    <ContentContainer>
      <PageHeader
        title="Import and Export Center"
        contextActions={
          <>
            <span style={subNavActiveStyle}>Templates</span>
            <Link href="/import-and-export-center/runs" style={subNavLinkStyle}>
              Runs
            </Link>
            <Link href="/import-and-export-center/exports" style={subNavLinkStyle}>
              Exports
            </Link>
            <Link href="/import-and-export-center/templates/new" style={primaryActionLinkStyle}>
              New template
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
          <span style={labelStyle}>Target module</span>
          <select
            key={query.targetModuleKey ?? "all-modules"}
            name="targetModuleKey"
            defaultValue={query.targetModuleKey ?? ""}
            style={selectStyle}
          >
            <option value="">All modules</option>
            {modules.map((module) => (
              <option key={module.key} value={module.key}>
                {moduleDisplayName(module)}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span style={labelStyle}>Active</span>
          <select
            key={query.isActive === null ? "all" : String(query.isActive)}
            name="isActive"
            defaultValue={query.isActive === null ? "" : String(query.isActive)}
            style={selectStyle}
          >
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
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
            href={buildImportTemplatesHref(query, {
              targetModuleKey: null,
              isActive: null,
              search: null,
            })}
            style={{ alignSelf: "flex-end", fontSize: "0.875rem", padding: "0.4rem 0" }}
          >
            Clear filters
          </Link>
        ) : null}
      </form>

      {templates.length === 0 ? (
        <EmptyState
          title={
            isPastLastPage
              ? "No more import templates"
              : hasFilters || query.search
                ? "No import templates match your filters"
                : "No import templates yet"
          }
          description={
            isPastLastPage
              ? "You've gone past the last page of results."
              : hasFilters || query.search
                ? "Try a different module, status, or search term."
                : "Import templates will appear here."
          }
          action={
            isPastLastPage ? (
              <Link
                href={buildImportTemplatesHref(query, {
                  offset: Math.max(0, query.offset - query.pageSize),
                })}
                style={{ fontSize: "0.875rem" }}
              >
                Previous
              </Link>
            ) : hasFilters || query.search ? (
              <Link
                href={buildImportTemplatesHref(query, {
                  targetModuleKey: null,
                  isActive: null,
                  search: null,
                })}
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
                  <th style={listTableHeaderCellStyle}>Name / Target module</th>
                  <th style={listTableHeaderCellStyle}>Format</th>
                  <th style={listTableHeaderCellStyle}>Version</th>
                  <th style={listTableHeaderCellStyle}>Active</th>
                  <th style={listTableHeaderCellStyle}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <TemplateRow key={template.id} template={template} modules={modules} />
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
              Showing {query.offset + 1}–{query.offset + templates.length}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
              <PageSizeSelect
                value={query.pageSize}
                hrefBySize={buildHrefBySize((pageSize) =>
                  buildImportTemplatesHref(query, { pageSize }),
                )}
              />
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {query.offset > 0 ? (
                  <Link
                    href={buildImportTemplatesHref(query, {
                      offset: Math.max(0, query.offset - query.pageSize),
                    })}
                  >
                    Previous
                  </Link>
                ) : null}
                {hasNextPage ? (
                  <Link
                    href={buildImportTemplatesHref(query, {
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

const labelStyle = {
  fontSize: "0.75rem",
  color: "var(--webdesk-dashboard-color-foreground-muted)",
} as const;

function TemplateRow({
  template,
  modules,
}: {
  readonly template: ImportTemplate;
  readonly modules: readonly ModuleRegistrySummary[];
}) {
  const targetModule = modules.find((module) => module.key === template.targetModuleKey);
  return (
    <tr>
      <td style={listTableCellStyle}>
        <Link href={`/import-and-export-center/templates/${template.id}`}>{template.name}</Link>
        <div
          style={{ fontSize: "0.75rem", color: "var(--webdesk-dashboard-color-foreground-muted)" }}
        >
          {targetModule
            ? (targetModule.displayName ?? targetModule.name)
            : template.targetModuleKey}
        </div>
      </td>
      <td
        style={{ ...listTableCellStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}
      >
        {IMPORT_EXPORT_FILE_FORMAT_LABEL[template.fileFormat]}
      </td>
      <td
        style={{ ...listTableCellStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}
      >
        {template.version}
      </td>
      <td style={listTableCellStyle}>{template.isActive ? "Active" : "Inactive"}</td>
      <td
        style={{ ...listTableCellStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}
      >
        {formatTimestamp(template.updatedAt)}
      </td>
    </tr>
  );
}
