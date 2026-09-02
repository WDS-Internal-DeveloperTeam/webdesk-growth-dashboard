import Link from "next/link";
import type { ReadyForClaudeTask } from "@webdesk/shared-types";
import { ContentContainer, EmptyState, PageHeader, StatusBadge } from "@webdesk/ui";
import { PageSizeSelect } from "@/components/page-size-select";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import {
  filterSelectStyle as selectStyle,
  filterSubmitButtonStyle as submitButtonStyle,
} from "@/lib/list-filter-styles";
import { listTableCellStyle, listTableHeaderCellStyle } from "@/lib/list-table-styles";
import { buildHrefBySize } from "@/lib/pagination";
import {
  buildReadyForClaudeQueueHref,
  formatTimestamp,
  getReadyForClaudeTasks,
  moduleDisplayName,
  parseReadyForClaudeQueueSearchParams,
  READY_FOR_CLAUDE_TASK_PRIORITY_LABEL,
  READY_FOR_CLAUDE_TASK_PRIORITY_VALUES,
  READY_FOR_CLAUDE_TASK_STATUS_LABEL,
  READY_FOR_CLAUDE_TASK_STATUS_VALUES,
  readyForClaudeTaskStatusBadge,
  sortModulesForPicker,
} from "@/lib/ready-for-claude-queue";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface ReadyForClaudeQueueListPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * No approved wireframe/screen spec exists for this module — renders exactly what
 * `GET /ready-for-claude-queue/tasks` returns and supports (`status`/`priority`/`targetModuleKey`/
 * `agent`/`search` filters and offset pagination), matching every sibling module's own "smallest
 * honest reading" precedent for an unsourced screen. Organization-wide, not project-scoped — no
 * `projectId` route segment, unlike Page Inventory/Keyword & Entity Library/Internal Linking
 * Library (this module's own D5 decision).
 *
 * The `targetModuleKey` filter's own options come from the session's own already-fetched
 * `session.navigation`, mirroring `ReviewAndApprovalCenterListPage`'s own identical reasoning
 * (`GET /authz/module-registry` is gated on a permission most roles lack).
 */
export default async function ReadyForClaudeQueueListPage({
  searchParams,
}: ReadyForClaudeQueueListPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const query = parseReadyForClaudeQueueSearchParams(await searchParams);
  const { items: tasks, hasNextPage } = await getReadyForClaudeTasks(query);
  const modules = sortModulesForPicker(session.navigation);

  const hasFilters =
    query.status !== null ||
    query.priority !== null ||
    query.targetModuleKey !== null ||
    query.agent !== null ||
    query.search !== null;
  const isPastLastPage = tasks.length === 0 && query.offset > 0;

  return (
    <ContentContainer>
      <PageHeader
        title="Ready for Claude Queue"
        contextActions={
          <Link href="/ready-for-claude-queue/new" style={primaryActionLinkStyle}>
            New task
          </Link>
        }
      />

      <form
        method="get"
        style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.5rem" }}
      >
        {/* Preserves the reader's page-size choice across a filter submit — without this, a
            native GET form submission builds its target URL purely from this form's own named
            fields, silently resetting it back to the default (matching every sibling list page's
            own hidden-pageSize precedent). */}
        <input type="hidden" name="pageSize" value={query.pageSize} />
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span
            style={{
              fontSize: "0.75rem",
              color: "var(--webdesk-dashboard-color-foreground-muted)",
            }}
          >
            Status
          </span>
          {/* `key` forces a remount whenever the underlying filter value changes, including back
              to "" on Clear filters — a Next.js <Link> soft-navigation otherwise re-renders this
              same DOM node in place, and an uncontrolled <select>'s defaultValue only takes
              effect on first mount. */}
          <select
            key={query.status ?? "all-statuses"}
            name="status"
            defaultValue={query.status ?? ""}
            style={selectStyle}
          >
            <option value="">All statuses</option>
            {READY_FOR_CLAUDE_TASK_STATUS_VALUES.map((value) => (
              <option key={value} value={value}>
                {READY_FOR_CLAUDE_TASK_STATUS_LABEL[value]}
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
            Priority
          </span>
          <select
            key={query.priority ?? "all-priorities"}
            name="priority"
            defaultValue={query.priority ?? ""}
            style={selectStyle}
          >
            <option value="">All priorities</option>
            {READY_FOR_CLAUDE_TASK_PRIORITY_VALUES.map((value) => (
              <option key={value} value={value}>
                {READY_FOR_CLAUDE_TASK_PRIORITY_LABEL[value]}
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
            Target module
          </span>
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
          <span
            style={{
              fontSize: "0.75rem",
              color: "var(--webdesk-dashboard-color-foreground-muted)",
            }}
          >
            Agent
          </span>
          <input
            key={query.agent ?? "no-agent"}
            type="text"
            name="agent"
            defaultValue={query.agent ?? ""}
            maxLength={255}
            style={selectStyle}
          />
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
        {hasFilters ? (
          <Link
            href={buildReadyForClaudeQueueHref(query, {
              status: null,
              priority: null,
              targetModuleKey: null,
              agent: null,
              search: null,
            })}
            style={{ alignSelf: "flex-end", fontSize: "0.875rem", padding: "0.4rem 0" }}
          >
            Clear filters
          </Link>
        ) : null}
      </form>

      {tasks.length === 0 ? (
        <EmptyState
          title={
            isPastLastPage
              ? "No more tasks"
              : hasFilters
                ? "No tasks match your filters"
                : "No tasks yet"
          }
          description={
            isPastLastPage
              ? "You've gone past the last page of results."
              : hasFilters
                ? "Try a different status, priority, module, agent, or search term."
                : "Ready for Claude tasks will appear here."
          }
          action={
            isPastLastPage ? (
              <Link
                href={buildReadyForClaudeQueueHref(query, {
                  offset: Math.max(0, query.offset - query.pageSize),
                })}
                style={{ fontSize: "0.875rem" }}
              >
                Previous
              </Link>
            ) : hasFilters ? (
              <Link
                href={buildReadyForClaudeQueueHref(query, {
                  status: null,
                  priority: null,
                  targetModuleKey: null,
                  agent: null,
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
                  <th style={listTableHeaderCellStyle}>Title / Target</th>
                  <th style={listTableHeaderCellStyle}>Status</th>
                  <th style={listTableHeaderCellStyle}>Priority</th>
                  <th style={listTableHeaderCellStyle}>Agent</th>
                  <th style={listTableHeaderCellStyle}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <TaskRow key={task.id} task={task} />
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
              Showing {query.offset + 1}–{query.offset + tasks.length}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
              <PageSizeSelect
                value={query.pageSize}
                hrefBySize={buildHrefBySize((pageSize) =>
                  buildReadyForClaudeQueueHref(query, { pageSize }),
                )}
              />
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {query.offset > 0 ? (
                  <Link
                    href={buildReadyForClaudeQueueHref(query, {
                      offset: Math.max(0, query.offset - query.pageSize),
                    })}
                  >
                    Previous
                  </Link>
                ) : null}
                {hasNextPage ? (
                  <Link
                    href={buildReadyForClaudeQueueHref(query, {
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

function TaskRow({ task }: { readonly task: ReadyForClaudeTask }) {
  const badge = readyForClaudeTaskStatusBadge(task.status);
  return (
    <tr>
      <td style={listTableCellStyle}>
        <Link href={`/ready-for-claude-queue/${task.id}`}>{task.title}</Link>
        {task.targetModuleKey ? (
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--webdesk-dashboard-color-foreground-muted)",
            }}
          >
            {task.targetModuleKey}
          </div>
        ) : null}
      </td>
      <td style={listTableCellStyle}>
        <StatusBadge status={badge.token} label={badge.label} />
      </td>
      <td
        style={{ ...listTableCellStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}
      >
        {READY_FOR_CLAUDE_TASK_PRIORITY_LABEL[task.priority]}
      </td>
      <td
        style={{ ...listTableCellStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}
      >
        {task.agent ?? "—"}
      </td>
      <td
        style={{ ...listTableCellStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}
      >
        {formatTimestamp(task.updatedAt)}
      </td>
    </tr>
  );
}
