import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ContentContainer, Fact, PageHeader, StatusBadge, typographyTokens } from "@webdesk/ui";
import { ChangeRecordStatusActions } from "@/components/change-record-status-actions";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import {
  CATEGORY_LABEL,
  changeRecordSeverityBadge,
  changeRecordStatusBadge,
  EDITABLE_STATUSES,
  formatTimestamp,
  getChangeRecord,
  moduleDisplayName,
  tolerateDiscard,
  withProjectId,
} from "@/lib/change-center";
import { dlStyle, h2Style, mutedStyle, sectionStyle } from "@/lib/detail-section-styles";
import { getProject } from "@/lib/projects";
import { firstValue } from "@/lib/search-params";
import { getServerSession } from "@/lib/server-session";
import { getUser } from "@/lib/users";

export const dynamic = "force-dynamic";

interface ChangeRecordDetailPageProps {
  readonly params: Promise<{ recordId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * No approved wireframe/screen-level spec exists for this module — sections mirror the backend's
 * own field grouping (Identity, Source, Content, Target record, Governance, Status), rendered as
 * sections rather than client-side tabs, the same simplification every prior detail page in this
 * app already establishes.
 *
 * Requires `?projectId=` — same rule as every other route in this module (see the list page's own
 * top doc comment). A missing/unresolvable `projectId` redirects to the list page's own
 * project-picker prompt before this page ever tries `getChangeRecord()`.
 *
 * `targetModuleKey` is resolved to a real display name via `session.navigation`
 * (`getServerSession()`'s own already-fetched module registry), not a dedicated fetch — mirrors
 * `ReviewDetailPage`'s own identical reasoning. The "Edit" link is hidden once the record leaves
 * `detected`/`under_review` (`EDITABLE_STATUSES`) — the backend rejects an edit of any other
 * status with a clean 400, matching Website Strategy Center's/Page Inventory's own terminal-state
 * Edit-link-hiding precedent.
 */
export default async function ChangeRecordDetailPage({
  params,
  searchParams,
}: ChangeRecordDetailPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const rawParams = await searchParams;
  const projectIdParam = firstValue(rawParams.projectId);
  const { recordId } = await params;

  // Fired concurrently with the project-existence check below, not sequentially after it,
  // matching every sibling detail page's own fixed ordering — getChangeRecord() only needs the
  // already-known projectId string, no field resolved from the Project entity itself.
  // tolerateDiscard() avoids an unhandled-rejection warning on the branch where project turns out
  // null and this promise is never awaited.
  const recordPromise = projectIdParam
    ? tolerateDiscard(getChangeRecord(projectIdParam, recordId))
    : null;

  const project = projectIdParam ? await getProject(projectIdParam) : null;
  if (!project) {
    redirect("/change-center");
  }

  const record = await recordPromise!;
  if (!record) {
    notFound();
  }

  // A non-essential enrichment lookup (the page's primary content — the record itself — doesn't
  // depend on it): GET /users/:userId is gated on users_roles:view, a grant only 2 of the 7
  // seeded roles hold, so it's individually guarded and degrades to null rather than crashing this
  // page, mirroring resolveLinkRelationships()'s own identical precedent.
  const assignee = record.assignedToUserId
    ? await getUser(record.assignedToUserId).catch((error: unknown) => {
        console.error("Failed to resolve change record assignee", error);
        return null;
      })
    : null;

  const targetModule = record.targetModuleKey
    ? session.navigation.find((module) => module.key === record.targetModuleKey)
    : null;

  const statusBadge = changeRecordStatusBadge(record.status);
  const severityBadge = changeRecordSeverityBadge(record.severity);
  const isEditable = EDITABLE_STATUSES.has(record.status);

  return (
    <ContentContainer>
      <PageHeader
        title={record.publicId}
        breadcrumbs={[
          { label: "Change Center", href: "/change-center" },
          { label: record.publicId },
        ]}
        linkComponent={Link}
        statusBadge={<StatusBadge status={statusBadge.token} label={statusBadge.label} />}
        contextActions={
          <>
            <ChangeRecordStatusActions
              projectId={project.id}
              recordId={record.id}
              status={record.status}
            />
            {isEditable ? (
              <Link
                href={withProjectId(`/change-center/${record.id}/edit`, project.id)}
                style={primaryActionLinkStyle}
              >
                Edit
              </Link>
            ) : null}
          </>
        }
      />

      <section style={sectionStyle}>
        <h2 style={h2Style}>Identity</h2>
        <dl style={dlStyle}>
          <Fact label="Public ID">
            <span style={{ fontFamily: typographyTokens.fontFamilyMono }}>{record.publicId}</span>
          </Fact>
          <Fact label="Record label">{record.recordLabel}</Fact>
          <Fact label="Category">{CATEGORY_LABEL[record.category]}</Fact>
          <Fact label="Severity">
            <StatusBadge status={severityBadge.token} label={severityBadge.label} />
          </Fact>
          <Fact label="Status">
            <StatusBadge status={statusBadge.token} label={statusBadge.label} />
          </Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Source</h2>
        <dl style={dlStyle}>
          <Fact label="Source">{record.source ?? "—"}</Fact>
          <Fact label="Scan finding ID">
            {record.scanFindingId ? (
              <span style={{ fontFamily: typographyTokens.fontFamilyMono }}>
                {record.scanFindingId}
              </span>
            ) : (
              "—"
            )}
          </Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Content</h2>
        <dl style={dlStyle}>
          <Fact label="Confidence">
            {record.confidence != null ? `${record.confidence}%` : "—"}
          </Fact>
        </dl>
        <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.75rem" }}>
          <div>
            <span style={mutedStyle}>Before value</span>
            <pre style={preStyle}>{record.beforeValue ?? "—"}</pre>
          </div>
          <div>
            <span style={mutedStyle}>After value</span>
            <pre style={preStyle}>{record.afterValue ?? "—"}</pre>
          </div>
          <div>
            <span style={mutedStyle}>Recommendation</span>
            <pre style={preStyle}>{record.recommendation ?? "—"}</pre>
          </div>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Target record</h2>
        <dl style={dlStyle}>
          <Fact label="Target module">
            {targetModule
              ? moduleDisplayName(targetModule)
              : record.targetModuleKey
                ? record.targetModuleKey
                : "Not linked"}
          </Fact>
          <Fact label="Target ID">
            {record.targetId ? (
              <span style={{ fontFamily: typographyTokens.fontFamilyMono }}>{record.targetId}</span>
            ) : (
              "—"
            )}
          </Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Governance</h2>
        <dl style={dlStyle}>
          <Fact label="Assigned to">
            {assignee ? (
              <>
                {assignee.displayName} <span style={mutedStyle}>({assignee.email})</span>
              </>
            ) : record.assignedToUserId ? (
              <span style={mutedStyle}>Assigned, but could not be resolved.</span>
            ) : (
              "Not assigned"
            )}
          </Fact>
        </dl>
        <div style={{ marginTop: "0.75rem" }}>
          <span style={mutedStyle}>Decision notes</span>
          <pre style={preStyle}>{record.decisionNotes ?? "—"}</pre>
        </div>
        {record.status === "apply_failed" ? (
          <div style={{ marginTop: "0.75rem" }}>
            <span style={mutedStyle}>Rollback guidance</span>
            <pre style={preStyle}>{record.rollbackGuidance ?? "—"}</pre>
          </div>
        ) : null}
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Timestamps</h2>
        <dl style={dlStyle}>
          <Fact label="Created">{formatTimestamp(record.createdAt)}</Fact>
          <Fact label="Updated">{formatTimestamp(record.updatedAt)}</Fact>
        </dl>
      </section>
    </ContentContainer>
  );
}

const preStyle = {
  margin: 0,
  marginTop: "0.25rem",
  padding: "0.75rem",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  fontSize: "0.8125rem",
  fontFamily: typographyTokens.fontFamilyMono,
  backgroundColor: "var(--webdesk-dashboard-color-surface)",
  borderRadius: "var(--webdesk-dashboard-radius-sm)",
} as const;
