import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, Fact, PageHeader, StatusBadge } from "@webdesk/ui";
import { ReadyForClaudeTaskStatusActions } from "@/components/ready-for-claude-task-status-actions";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import { dlStyle, h2Style, mutedStyle, sectionStyle } from "@/lib/detail-section-styles";
import { isSafeHttpUrl } from "@/lib/safe-http-url";
import {
  formatTimestamp,
  getReadyForClaudeTask,
  READY_FOR_CLAUDE_TASK_PRIORITY_LABEL,
  readyForClaudeTaskStatusBadge,
} from "@/lib/ready-for-claude-queue";
import { getServerSession } from "@/lib/server-session";
import { getUsersByIds } from "@/lib/users";

export const dynamic = "force-dynamic";

interface ReadyForClaudeTaskDetailPageProps {
  readonly params: Promise<{ taskId: string }>;
}

const TERMINAL_STATUSES = new Set(["completed", "cancelled", "failed"]);

/**
 * No approved wireframe exists for this module — sections mirror the backend's own field grouping
 * (Identity, Target record, Workflow, Assignment, Development, Staging, Production, Failure &
 * retry, Timestamps), rendered as sections rather than client-side tabs, the same simplification
 * every sibling module's detail page already establishes.
 *
 * Every identity this page needs (operator/developer/reviewer/production approver/dependency
 * creators — the last not shown) is resolved via `getUsersByIds()`, which already degrades a
 * resolution failure (most roles lack `users_roles:view`) to a missing map entry rather than
 * throwing, matching `ReviewDetailPage`'s own precedent. Dependency titles are resolved with a
 * best-effort batch of individual `getReadyForClaudeTask()` calls (no batch-lookup endpoint exists
 * for this table) — capped at the DTO's own 50-id `dependencies` limit, and any lookup that fails
 * or returns nothing degrades to showing the raw id, never crashing the page.
 *
 * "Edit" is hidden once `status` reaches a terminal state (`completed`/`cancelled`/`failed`) —
 * `ReadyForClaudeTasksService.update()` hard-rejects any edit of one outright, so the link is
 * hidden rather than left clickable only to 400 on submit, matching
 * `WebsiteStrategyRecordDetail`'s own identical precedent for its own terminal states.
 * `productionApproval`/`productionApproverUserId` are shown read-only here — both are
 * server-managed, stamped only by the `approved -> completed` transition, never a form field.
 * `retryCount` is likewise shown read-only, not editable via the create/edit form (see
 * `ReadyForClaudeTaskForm`'s own doc comment for why).
 */
export default async function ReadyForClaudeTaskDetailPage({
  params,
}: ReadyForClaudeTaskDetailPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { taskId } = await params;
  const task = await getReadyForClaudeTask(taskId);
  if (!task) {
    notFound();
  }

  const userIds = new Set<string>();
  if (task.operatorUserId) userIds.add(task.operatorUserId);
  if (task.developerUserId) userIds.add(task.developerUserId);
  if (task.reviewerUserId) userIds.add(task.reviewerUserId);
  if (task.productionApproverUserId) userIds.add(task.productionApproverUserId);
  if (task.createdBy) userIds.add(task.createdBy);
  if (task.updatedBy) userIds.add(task.updatedBy);

  const [users, dependencyTasks] = await Promise.all([
    getUsersByIds([...userIds]),
    Promise.all(
      task.dependencies.map(async (id) => {
        try {
          return await getReadyForClaudeTask(id);
        } catch {
          return null;
        }
      }),
    ),
  ]);

  const badge = readyForClaudeTaskStatusBadge(task.status);
  const isTerminal = TERMINAL_STATUSES.has(task.status);
  const userLabel = (userId: string | null): string =>
    userId ? (users.get(userId)?.displayName ?? userId) : "Not assigned";

  return (
    <ContentContainer>
      <PageHeader
        title={task.title}
        breadcrumbs={[
          { label: "Ready for Claude Queue", href: "/ready-for-claude-queue" },
          { label: task.title },
        ]}
        linkComponent={Link}
        statusBadge={<StatusBadge status={badge.token} label={badge.label} />}
        contextActions={
          <>
            <ReadyForClaudeTaskStatusActions taskId={task.id} status={task.status} />
            {!isTerminal ? (
              <Link href={`/ready-for-claude-queue/${task.id}/edit`} style={primaryActionLinkStyle}>
                Edit
              </Link>
            ) : null}
          </>
        }
      />

      <section style={sectionStyle}>
        <h2 style={h2Style}>Identity</h2>
        <dl style={dlStyle}>
          <Fact label="Public ID">{task.publicId}</Fact>
          <Fact label="Priority">{READY_FOR_CLAUDE_TASK_PRIORITY_LABEL[task.priority]}</Fact>
          <Fact label="Agent">{task.agent ?? "Not set"}</Fact>
          <Fact label="Agent version">{task.agentVersion ?? "Not set"}</Fact>
          <Fact label="Project">{task.projectId ?? "None"}</Fact>
          <Fact label="Stage">{task.stage ?? "Not set"}</Fact>
          <Fact label="Due date">{task.dueDate ? formatTimestamp(task.dueDate) : "Not set"}</Fact>
          <Fact label="Audit reference">{task.auditReference ?? "Not set"}</Fact>
        </dl>
        {task.description ? (
          <p style={{ ...mutedStyle, marginTop: "0.75rem", whiteSpace: "pre-wrap" }}>
            {task.description}
          </p>
        ) : null}
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Target record</h2>
        <dl style={dlStyle}>
          <Fact label="Target module">{task.targetModuleKey ?? "Not about a specific record"}</Fact>
          <Fact label="Target ID">{task.targetId ?? "Not set"}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Dependencies</h2>
        {task.dependencies.length === 0 ? (
          <p style={mutedStyle}>No dependencies.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.875rem" }}>
            {task.dependencies.map((id, index) => {
              const dependency = dependencyTasks[index];
              return (
                <li key={id}>
                  {dependency ? (
                    <Link href={`/ready-for-claude-queue/${dependency.id}`}>
                      {dependency.title}
                    </Link>
                  ) : (
                    id
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Assignment</h2>
        <dl style={dlStyle}>
          <Fact label="Operator">{userLabel(task.operatorUserId)}</Fact>
          <Fact label="Developer">{userLabel(task.developerUserId)}</Fact>
          <Fact label="Reviewer">{userLabel(task.reviewerUserId)}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Development</h2>
        <dl style={dlStyle}>
          <Fact label="Feature branch">{task.featureBranch ?? "Not set"}</Fact>
          <Fact label="Source commit">{task.sourceCommit ?? "Not set"}</Fact>
          <Fact label="PR ID">{task.prId ?? "Not set"}</Fact>
          <Fact label="PR URL">
            {task.prUrl && isSafeHttpUrl(task.prUrl) ? (
              <a href={task.prUrl} target="_blank" rel="noopener noreferrer">
                {task.prUrl}
              </a>
            ) : (
              (task.prUrl ?? "Not set")
            )}
          </Fact>
          <Fact label="PR status">{task.prStatus ?? "Not set"}</Fact>
          <Fact label="Code review result">{task.codeReviewResult ?? "Not set"}</Fact>
        </dl>
        {task.dashboardReview ? (
          <div style={{ marginTop: "0.75rem" }}>
            <span style={mutedStyle}>Dashboard review</span>
            <p style={{ whiteSpace: "pre-wrap", marginTop: "0.25rem" }}>{task.dashboardReview}</p>
          </div>
        ) : null}
        {task.changesRequestedNotes ? (
          <div style={{ marginTop: "0.75rem" }}>
            <span style={mutedStyle}>Changes requested notes</span>
            <p style={{ whiteSpace: "pre-wrap", marginTop: "0.25rem" }}>
              {task.changesRequestedNotes}
            </p>
          </div>
        ) : null}
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Staging</h2>
        <dl style={dlStyle}>
          <Fact label="Staging commit">{task.stagingCommit ?? "Not set"}</Fact>
          <Fact label="Staging deployment">{task.stagingDeployment ?? "Not set"}</Fact>
          <Fact label="Staging URL">
            {task.stagingUrl && isSafeHttpUrl(task.stagingUrl) ? (
              <a href={task.stagingUrl} target="_blank" rel="noopener noreferrer">
                {task.stagingUrl}
              </a>
            ) : (
              (task.stagingUrl ?? "Not set")
            )}
          </Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Production</h2>
        <dl style={dlStyle}>
          <Fact label="Production approval">
            {task.productionApproval ? "Approved" : "Not approved"}
          </Fact>
          <Fact label="Production approver">{userLabel(task.productionApproverUserId)}</Fact>
          <Fact label="Production commit">{task.productionCommit ?? "Not set"}</Fact>
          <Fact label="Production deployment">{task.productionDeployment ?? "Not set"}</Fact>
          <Fact label="Rollback version">{task.rollbackVersion ?? "Not set"}</Fact>
        </dl>
        {task.productionVerification ? (
          <div style={{ marginTop: "0.75rem" }}>
            <span style={mutedStyle}>Production verification</span>
            <p style={{ whiteSpace: "pre-wrap", marginTop: "0.25rem" }}>
              {task.productionVerification}
            </p>
          </div>
        ) : null}
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Failure &amp; retry</h2>
        <dl style={dlStyle}>
          <Fact label="Retry count">{task.retryCount}</Fact>
        </dl>
        {task.failureReason ? (
          <div style={{ marginTop: "0.75rem" }}>
            <span style={mutedStyle}>Failure reason</span>
            <p style={{ whiteSpace: "pre-wrap", marginTop: "0.25rem" }}>{task.failureReason}</p>
          </div>
        ) : null}
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Timestamps</h2>
        <dl style={dlStyle}>
          <Fact label="Created by">{userLabel(task.createdBy)}</Fact>
          <Fact label="Updated by">{userLabel(task.updatedBy)}</Fact>
          <Fact label="Created">{formatTimestamp(task.createdAt)}</Fact>
          <Fact label="Updated">{formatTimestamp(task.updatedAt)}</Fact>
        </dl>
      </section>
    </ContentContainer>
  );
}
