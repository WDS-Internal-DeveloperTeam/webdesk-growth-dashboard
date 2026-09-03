import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ContentContainer, Fact, PageHeader, StatusBadge } from "@webdesk/ui";
import { ReleaseApprovalsSection } from "@/components/release-approvals-section";
import { ReleaseArtifactsSection } from "@/components/release-artifacts-section";
import { ReleaseDeploymentsSection } from "@/components/release-deployments-section";
import { ReleaseRollbackRecord } from "@/components/release-rollback-record";
import { ReleaseSmokeTestsSection } from "@/components/release-smoke-tests-section";
import { ReleaseStatusActions } from "@/components/release-status-actions";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import { tolerateDiscard } from "@/lib/business-knowledge";
import { dlStyle, h2Style, mutedStyle, sectionStyle } from "@/lib/detail-section-styles";
import { getProject } from "@/lib/projects";
import {
  formatTimestamp,
  getRelease,
  getReleaseApprovals,
  getReleaseArtifacts,
  getReleaseDeployments,
  getReleaseRollbackRecord,
  getReleaseSmokeTests,
  releaseStatusBadge,
  RELEASE_TYPE_LABEL,
  withProjectId,
} from "@/lib/release-center";
import { firstValue } from "@/lib/search-params";
import { getServerSession } from "@/lib/server-session";
import { getUsersByIds } from "@/lib/users";

export const dynamic = "force-dynamic";

interface ReleaseDetailPageProps {
  readonly params: Promise<{ releaseId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Mirrors `ReleasesService`'s own `RELEASE_TERMINAL_STATUSES` — kept in sync by hand, the same
 *  "mirror the backend constant client-side" convention every sibling module's own terminal-state
 *  edit-hiding logic already uses. Content edits are blocked once a release reaches
 *  `completed`/`rolled_back`, OR `checks_failed` (whose only outbound edges are `submit`-gated
 *  re-checks, not `edit` — `ReleasesService`'s own `EDIT_BLOCKED_STATUSES`, a slightly wider set
 *  than the sub-resource-blocking `RELEASE_TERMINAL_STATUSES`). */
const EDIT_BLOCKED_STATUSES: ReadonlySet<string> = new Set([
  "completed",
  "rolled_back",
  "checks_failed",
]);

/** Mirrors `RELEASE_TERMINAL_STATUSES` from `release-center.constants.ts` — used only to hide the
 *  Delete/create actions on the artifacts/deployments/smoke-tests sub-resource sections as a UX
 *  nicety; the backend independently rejects each of those writes outright once the release
 *  reaches either status regardless of what this constant says. */
const SUB_RESOURCE_WRITE_BLOCKED_STATUSES: ReadonlySet<string> = new Set([
  "completed",
  "rolled_back",
]);

/**
 * No approved wireframe/screen-level spec exists for this module — sections mirror the backend's
 * own field grouping (Identity/Assignees, Content, Artifacts, Approvals, Deployments, Smoke Tests,
 * Rollback, Status), rendered as sections rather than client-side tabs, the same simplification
 * every sibling module's own detail page already establishes. "Edit" is hidden once the release
 * reaches one of `EDIT_BLOCKED_STATUSES`, matching `WebsiteStrategyRecordDetail`'s/
 * `WireframeLibraryDetail`'s own terminal-state Edit-link-hiding precedent.
 *
 * Every sub-resource fetch (artifacts/approvals/deployments/smoke tests/rollback record) fires
 * concurrently with the release fetch itself via `tolerateDiscard()`, not sequentially after it —
 * matches every sibling detail page's own established pattern.
 */
export default async function ReleaseDetailPage({ params, searchParams }: ReleaseDetailPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const rawParams = await searchParams;
  const projectIdParam = firstValue(rawParams.projectId);
  const { releaseId } = await params;

  const releasePromise = projectIdParam
    ? tolerateDiscard(getRelease(projectIdParam, releaseId))
    : null;
  const artifactsPromise = projectIdParam
    ? tolerateDiscard(getReleaseArtifacts(projectIdParam, releaseId))
    : null;
  const approvalsPromise = projectIdParam
    ? tolerateDiscard(getReleaseApprovals(projectIdParam, releaseId))
    : null;
  const deploymentsPromise = projectIdParam
    ? tolerateDiscard(getReleaseDeployments(projectIdParam, releaseId))
    : null;
  const smokeTestsPromise = projectIdParam
    ? tolerateDiscard(getReleaseSmokeTests(projectIdParam, releaseId))
    : null;
  const rollbackRecordPromise = projectIdParam
    ? tolerateDiscard(getReleaseRollbackRecord(projectIdParam, releaseId))
    : null;

  const project = projectIdParam ? await getProject(projectIdParam) : null;
  if (!project) {
    redirect("/release-center");
  }

  const [release, artifacts, approvals, deployments, smokeTests, rollbackRecord] =
    await Promise.all([
      releasePromise!,
      artifactsPromise!,
      approvalsPromise!,
      deploymentsPromise!,
      smokeTestsPromise!,
      rollbackRecordPromise!,
    ]);
  if (!release) {
    notFound();
  }

  const userIds = new Set<string>();
  if (release.assignedDeveloperUserId) userIds.add(release.assignedDeveloperUserId);
  if (release.assignedReviewerUserId) userIds.add(release.assignedReviewerUserId);
  if (release.productionApproverUserId) userIds.add(release.productionApproverUserId);
  for (const approval of approvals) {
    if (approval.decidedByUserId) userIds.add(approval.decidedByUserId);
  }
  if (rollbackRecord?.rolledBackByUserId) userIds.add(rollbackRecord.rolledBackByUserId);
  const users = await getUsersByIds([...userIds]);

  const developerName = release.assignedDeveloperUserId
    ? (users.get(release.assignedDeveloperUserId)?.displayName ?? release.assignedDeveloperUserId)
    : null;
  const reviewerName = release.assignedReviewerUserId
    ? (users.get(release.assignedReviewerUserId)?.displayName ?? release.assignedReviewerUserId)
    : null;
  const productionApproverName = release.productionApproverUserId
    ? (users.get(release.productionApproverUserId)?.displayName ?? release.productionApproverUserId)
    : null;
  const decidedByNameById = new Map(
    [...users.entries()].map(([id, user]) => [id, user.displayName]),
  );
  const rolledBackByName = rollbackRecord?.rolledBackByUserId
    ? (users.get(rollbackRecord.rolledBackByUserId)?.displayName ?? null)
    : null;

  const badge = releaseStatusBadge(release.status);
  const subResourceWriteBlocked = SUB_RESOURCE_WRITE_BLOCKED_STATUSES.has(release.status);

  return (
    <ContentContainer>
      <PageHeader
        title={release.title}
        breadcrumbs={[
          { label: "Release Center", href: withProjectId("/release-center", project.id) },
          { label: release.title },
        ]}
        linkComponent={Link}
        statusBadge={<StatusBadge status={badge.token} label={badge.label} />}
        contextActions={
          !EDIT_BLOCKED_STATUSES.has(release.status) ? (
            <Link
              href={withProjectId(`/release-center/${release.id}/edit`, project.id)}
              style={primaryActionLinkStyle}
            >
              Edit
            </Link>
          ) : undefined
        }
      />

      <section style={sectionStyle}>
        <h2 style={h2Style}>Identity &amp; assignees</h2>
        <dl style={dlStyle}>
          <Fact label="Public ID">{release.publicId}</Fact>
          <Fact label="Release type">{RELEASE_TYPE_LABEL[release.releaseType]}</Fact>
          <Fact label="Assigned developer">{developerName ?? "—"}</Fact>
          <Fact label="Assigned reviewer">{reviewerName ?? "—"}</Fact>
          <Fact label="Production approver">{productionApproverName ?? "—"}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Content</h2>
        {release.notes ? (
          <p style={contentStyle}>{release.notes}</p>
        ) : (
          <p style={mutedStyle}>No notes.</p>
        )}
        {release.hotfixReason ? (
          <div style={{ marginTop: "0.75rem" }}>
            <span style={mutedStyle}>Hotfix reason</span>
            <p style={{ ...contentStyle, marginTop: "0.25rem" }}>{release.hotfixReason}</p>
          </div>
        ) : null}
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Status</h2>
        <ReleaseStatusActions
          projectId={project.id}
          releaseId={release.id}
          status={release.status}
        />
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Artifacts</h2>
        <ReleaseArtifactsSection
          projectId={project.id}
          releaseId={release.id}
          initialArtifacts={artifacts}
          deletionBlocked={subResourceWriteBlocked}
        />
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Approvals</h2>
        <ReleaseApprovalsSection approvals={approvals} decidedByNameById={decidedByNameById} />
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Deployments</h2>
        <ReleaseDeploymentsSection
          projectId={project.id}
          releaseId={release.id}
          initialDeployments={deployments}
          creationBlocked={subResourceWriteBlocked}
        />
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Smoke tests</h2>
        <ReleaseSmokeTestsSection
          projectId={project.id}
          releaseId={release.id}
          initialSmokeTests={smokeTests}
          creationBlocked={subResourceWriteBlocked}
        />
      </section>

      {rollbackRecord ? (
        <section style={sectionStyle}>
          <h2 style={h2Style}>Rollback</h2>
          <ReleaseRollbackRecord
            projectId={project.id}
            record={rollbackRecord}
            rolledBackByName={rolledBackByName}
          />
        </section>
      ) : null}

      <section style={sectionStyle}>
        <h2 style={h2Style}>Timestamps</h2>
        <dl style={dlStyle}>
          <Fact label="Created">{formatTimestamp(release.createdAt)}</Fact>
          <Fact label="Updated">{formatTimestamp(release.updatedAt)}</Fact>
        </dl>
      </section>
    </ContentContainer>
  );
}

const contentStyle = {
  fontSize: "0.9375rem",
  color: "var(--webdesk-dashboard-color-foreground)",
  whiteSpace: "pre-wrap",
  margin: 0,
} as const;
