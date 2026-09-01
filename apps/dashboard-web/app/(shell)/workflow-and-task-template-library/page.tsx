import Link from "next/link";
import type { WorkflowTaskTemplate } from "@webdesk/shared-types";
import { ContentContainer, EmptyState, PageHeader, StatusBadge } from "@webdesk/ui";
import { PageSizeSelect } from "@/components/page-size-select";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import {
  filterSelectStyle as selectStyle,
  filterSubmitButtonStyle as submitButtonStyle,
} from "@/lib/list-filter-styles";
import { listTableCellStyle, listTableHeaderCellStyle } from "@/lib/list-table-styles";
import { buildHrefBySize } from "@/lib/pagination";
import { getServerSession } from "@/lib/server-session";
import {
  APPROVAL_STATUS_LABEL,
  APPROVAL_STATUS_VALUES,
  TEMPLATE_TYPE_LABEL,
  TEMPLATE_TYPE_VALUES,
} from "@/lib/workflow-and-task-template-library-query";
import {
  buildWorkflowTaskTemplateHref,
  formatTimestamp,
  getWorkflowTaskTemplates,
  parseWorkflowTaskTemplateSearchParams,
  workflowTaskTemplateApprovalStatusBadge,
} from "@/lib/workflow-and-task-template-library";

export const dynamic = "force-dynamic";

interface WorkflowTaskTemplateListPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * No approved wireframe/screen spec exists for this module (`03_Detailed_Module_Specifications.md
 * §29` is a flat field list, no screen description) — renders exactly what
 * `GET /workflow-and-task-template-library/templates` returns and supports (a `templateType`
 * filter, an `approvalStatus` filter, `search`, and offset pagination, no sort), matching the Brand/
 * Content Template/Persona/Service Library list pages' own "smallest honest reading" precedent for
 * an unsourced screen.
 */
export default async function WorkflowTaskTemplateListPage({
  searchParams,
}: WorkflowTaskTemplateListPageProps) {
  // The (shell) layout already redirects unauthenticated callers to sign-in before this page
  // renders — this defensive fallback avoids firing the list fetch in parallel with a redirect
  // that would just discard the result, matching every other page in this app.
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const query = parseWorkflowTaskTemplateSearchParams(await searchParams);
  const { items: templates, hasNextPage } = await getWorkflowTaskTemplates(query);
  const hasFilters = query.templateType !== null || query.approvalStatus !== null;
  const isPastLastPage = templates.length === 0 && query.offset > 0;

  return (
    <ContentContainer>
      <PageHeader
        title="Workflow and Task Template Library"
        contextActions={
          <Link href="/workflow-and-task-template-library/new" style={primaryActionLinkStyle}>
            New template
          </Link>
        }
      />

      <form
        method="get"
        style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.5rem" }}
      >
        {/* Preserves the reader's page-size choice across a filter submit — without it, a native
            GET form submission builds its target URL purely from this form's own named fields,
            silently dropping any existing `?pageSize=` and resetting it back to the default. */}
        <input type="hidden" name="pageSize" value={query.pageSize} />
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span
            style={{
              fontSize: "0.75rem",
              color: "var(--webdesk-dashboard-color-foreground-muted)",
            }}
          >
            Template type
          </span>
          {/* `key` forces a remount whenever the underlying filter value changes, including back
              to "" on Clear filters — a Next.js <Link> soft-navigation otherwise re-renders this
              same DOM node in place, and an uncontrolled <select>'s defaultValue only takes effect
              on first mount (see brand-library/page.tsx's own identical note). */}
          <select
            key={query.templateType ?? "all-template-types"}
            name="templateType"
            defaultValue={query.templateType ?? ""}
            style={selectStyle}
          >
            <option value="">All template types</option>
            {TEMPLATE_TYPE_VALUES.map((value) => (
              <option key={value} value={value}>
                {TEMPLATE_TYPE_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span
            style={{
              fontSize: "0.75rem",
              color: "var(--webdesk-dashboard-color-foreground-muted)",
            }}
          >
            Approval status
          </span>
          <select
            key={query.approvalStatus ?? "all-approval-statuses"}
            name="approvalStatus"
            defaultValue={query.approvalStatus ?? ""}
            style={selectStyle}
          >
            <option value="">All approval statuses</option>
            {APPROVAL_STATUS_VALUES.map((value) => (
              <option key={value} value={value}>
                {APPROVAL_STATUS_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
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
            href="/workflow-and-task-template-library"
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
              ? "No more workflow task templates"
              : hasFilters || query.search
                ? "No workflow task templates match your filters"
                : "No workflow task templates yet"
          }
          description={
            isPastLastPage
              ? "You've gone past the last page of results."
              : hasFilters || query.search
                ? "Try a different type, status, or search term."
                : "Workflow and task templates created for this organization will appear here."
          }
          action={
            isPastLastPage ? (
              <Link
                href={buildWorkflowTaskTemplateHref(query, {
                  offset: Math.max(0, query.offset - query.pageSize),
                })}
                style={{ fontSize: "0.875rem" }}
              >
                Previous
              </Link>
            ) : hasFilters || query.search ? (
              <Link href="/workflow-and-task-template-library" style={{ fontSize: "0.875rem" }}>
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
                  <th style={thStyle}>Title</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Authorized stage</th>
                  <th style={thStyle}>Approval</th>
                  <th style={thStyle}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <WorkflowTaskTemplateRow key={template.id} template={template} />
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
                  buildWorkflowTaskTemplateHref(query, { pageSize }),
                )}
              />
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {query.offset > 0 ? (
                  <Link
                    href={buildWorkflowTaskTemplateHref(query, {
                      offset: Math.max(0, query.offset - query.pageSize),
                    })}
                  >
                    Previous
                  </Link>
                ) : null}
                {hasNextPage ? (
                  <Link
                    href={buildWorkflowTaskTemplateHref(query, {
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

function WorkflowTaskTemplateRow({ template }: { readonly template: WorkflowTaskTemplate }) {
  const approvalBadge = workflowTaskTemplateApprovalStatusBadge(template.approvalStatus);
  return (
    <tr>
      <td style={tdStyle}>
        <Link href={`/workflow-and-task-template-library/${template.id}`}>{template.title}</Link>
      </td>
      <td style={tdStyle}>{TEMPLATE_TYPE_LABEL[template.templateType]}</td>
      <td style={tdStyle}>{template.authorizedStage}</td>
      <td style={tdStyle}>
        <StatusBadge status={approvalBadge.token} label={approvalBadge.label} />
      </td>
      <td style={{ ...tdStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
        {formatTimestamp(template.updatedAt)}
      </td>
    </tr>
  );
}
