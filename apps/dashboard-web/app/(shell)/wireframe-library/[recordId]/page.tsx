import Link from "next/link";
import { notFound } from "next/navigation";
import type { UserSummary, WireframeRecord } from "@webdesk/shared-types";
import { ContentContainer, Fact, PageHeader, StatusBadge } from "@webdesk/ui";
import { SanitizedRichText } from "@/components/sanitized-rich-text";
import { WireframeStatusActions } from "@/components/wireframe-status-actions";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import {
  dlStyle,
  h2Style,
  mutedStyle,
  richContentStyle,
  sectionStyle,
  subsectionStyle,
  versionCardStyle,
} from "@/lib/detail-section-styles";
import { isSafeHttpUrl } from "@/lib/safe-http-url";
import { getUser } from "@/lib/users";
import {
  formatTimestamp,
  getWireframe,
  getWireframeVersions,
  VIEWPORT_LABEL,
  wireframeApprovalStatusBadge,
} from "@/lib/wireframe-library";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface WireframeLibraryDetailPageProps {
  readonly params: Promise<{ recordId: string }>;
}

/**
 * No approved wireframe exists for this module — sections mirror the backend's own field grouping
 * (Identity, Content, Relationships, Status, Version history), rendered as sections rather than
 * client-side tabs, the same simplification the Project/Business Knowledge Center/Service
 * Library/Persona Library/Website Strategy Center/Section and Pattern Library/Page Template
 * Library detail pages already establish.
 *
 * "Version history" mirrors `SectionAndPatternLibraryDetailPage`'s/`PageTemplateLibraryDetailPage`'s
 * own genuinely novel requirement — every version from `GET .../:recordId/versions` (oldest first,
 * reversed here for newest-first display) is listed with its own version number/status/page-or-
 * module/updated timestamp, and its own annotations/interaction notes/file reference are viewable
 * via a native `<details>`/`<summary>` disclosure — zero client JS, fully server-rendered. Opening
 * two disclosures side by side is this module's answer to the canonical spec's own named "compare
 * versions" action, without inventing a real diffing UI no sibling module has ever built. The
 * CURRENT version's own content still renders in the normal sections above, exactly as every
 * sibling detail page renders its own primary content — the version-history list additionally
 * repeats it (as the "(current)"-labeled entry) so every version, including the current one, is
 * browsable through the identical mechanism (the same accepted, tracked debt
 * `WebsiteStrategyCenterDetailPage`'s/`DesignTokenLibraryDetailPage`'s/
 * `SectionAndPatternLibraryDetailPage`'s own doc comments already document once for the resulting
 * double-render of the current version).
 *
 * `annotations`/`interactionNotes` render through `SanitizedRichText` (real HTML from the
 * rich-text editor, sanitized at both write time and render time).
 */
export default async function WireframeLibraryDetailPage({
  params,
}: WireframeLibraryDetailPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { recordId } = await params;
  const [record, versions] = await Promise.all([
    getWireframe(recordId),
    getWireframeVersions(recordId),
  ]);
  if (!record) {
    notFound();
  }

  // Resolved once the record itself is known. A secondary, non-essential lookup (this page's
  // primary content doesn't depend on it), so a transient backend failure here must degrade to
  // "reviewer unresolved" rather than crashing the whole detail page, mirroring
  // `InternalLinkForm`'s/`ProjectForm`'s own edit-page reviewer/owner-resolution precedent.
  let reviewer: UserSummary | null = null;
  if (record.reviewerUserId) {
    try {
      reviewer = await getUser(record.reviewerUserId);
    } catch (error) {
      console.error("Failed to resolve wireframe record reviewer", error);
    }
  }

  const approvalBadge = wireframeApprovalStatusBadge(record.approvalStatus);
  // Newest first for display — the backend returns oldest first (its own natural insertion order).
  const versionsNewestFirst = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);

  return (
    <ContentContainer>
      <PageHeader
        title={record.pageOrModule}
        breadcrumbs={[
          { label: "Wireframe Library", href: "/wireframe-library" },
          { label: record.pageOrModule },
        ]}
        linkComponent={Link}
        statusBadge={<StatusBadge status={approvalBadge.token} label={approvalBadge.label} />}
        contextActions={
          <>
            <WireframeStatusActions
              recordId={record.recordId}
              approvalStatus={record.approvalStatus}
            />
            {/* archived/superseded are terminal — the backend rejects any edit of one outright
                (wireframes.service.ts's own update() guard), so the link is hidden rather than
                left clickable only to 400 on submit, matching WireframeStatusActions's own
                self-hiding behavior for these same two statuses. */}
            {record.approvalStatus !== "archived" && record.approvalStatus !== "superseded" ? (
              <Link
                href={`/wireframe-library/${record.recordId}/edit`}
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
          <Fact label="Public ID">{record.publicId}</Fact>
          <Fact label="Viewport">{VIEWPORT_LABEL[record.viewport]}</Fact>
          <Fact label="Version">v{record.versionNumber}</Fact>
          <Fact label="Created">{formatTimestamp(record.createdAt)}</Fact>
          <Fact label="Updated">{formatTimestamp(record.updatedAt)}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Content</h2>
        <div style={subsectionStyle}>
          <span style={mutedStyle}>File reference</span>
          <div>
            {record.fileReference && isSafeHttpUrl(record.fileReference) ? (
              <a href={record.fileReference} target="_blank" rel="noreferrer noopener">
                {record.fileReference}
              </a>
            ) : record.fileReference ? (
              <p style={richContentStyle}>{record.fileReference}</p>
            ) : (
              <p style={mutedStyle}>Not set.</p>
            )}
          </div>
        </div>
        <div style={subsectionStyle}>
          <span style={mutedStyle}>Annotations</span>
          {record.annotations ? (
            <SanitizedRichText html={record.annotations} style={richContentStyle} />
          ) : (
            <p style={mutedStyle}>Not set.</p>
          )}
        </div>
        <div style={subsectionStyle}>
          <span style={mutedStyle}>Interaction notes</span>
          {record.interactionNotes ? (
            <SanitizedRichText html={record.interactionNotes} style={richContentStyle} />
          ) : (
            <p style={mutedStyle}>Not set.</p>
          )}
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Relationships</h2>
        <dl style={dlStyle}>
          <Fact label="Related template ID">{record.relatedTemplateId ?? "Not set."}</Fact>
          <Fact label="Reviewer">
            {reviewer
              ? `${reviewer.displayName} (${reviewer.email})`
              : record.reviewerUserId
                ? "Unresolved (account may be disabled or removed)"
                : "Not set."}
          </Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Status</h2>
        <dl style={dlStyle}>
          <Fact label="Approval status">
            <StatusBadge status={approvalBadge.token} label={approvalBadge.label} />
          </Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Version history</h2>
        {versionsNewestFirst.length === 0 ? (
          <p style={mutedStyle}>No version history available.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {versionsNewestFirst.map((version) => (
              <VersionEntry key={version.id} version={version} />
            ))}
          </ul>
        )}
      </section>
    </ContentContainer>
  );
}

function VersionEntry({ version }: { readonly version: WireframeRecord }) {
  const badge = wireframeApprovalStatusBadge(version.approvalStatus);
  // Uses the version row's own isCurrent field (populated by the same GET .../:recordId/versions
  // response every entry here already comes from) rather than comparing this row's id against a
  // SEPARATE, independently-timed getWireframe() fetch — the two requests aren't transactionally
  // consistent, so a concurrent edit/status transition forking a new version between them could
  // otherwise mislabel which entry is current, the exact code-review fix
  // WebsiteStrategyCenterDetailPage's/DesignTokenLibraryDetailPage's/
  // SectionAndPatternLibraryDetailPage's own VersionEntry already established.
  const isCurrent = version.isCurrent;

  return (
    <li style={versionCardStyle}>
      <details>
        <summary
          style={{
            cursor: "pointer",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "0.75rem",
            fontSize: "0.875rem",
          }}
        >
          <span style={{ fontWeight: 600 }}>
            Version {version.versionNumber}
            {isCurrent ? " (current)" : ""}
          </span>
          <StatusBadge status={badge.token} label={badge.label} />
          <span style={mutedStyle}>{VIEWPORT_LABEL[version.viewport]}</span>
          <span style={mutedStyle}>Updated {formatTimestamp(version.updatedAt)}</span>
        </summary>
        <div style={{ marginTop: "0.75rem" }}>
          <div style={subsectionStyle}>
            <span style={mutedStyle}>Annotations</span>
            {version.annotations ? (
              <SanitizedRichText html={version.annotations} style={richContentStyle} />
            ) : (
              <p style={mutedStyle}>Not set.</p>
            )}
          </div>
          <div style={subsectionStyle}>
            <span style={mutedStyle}>Interaction notes</span>
            {version.interactionNotes ? (
              <SanitizedRichText html={version.interactionNotes} style={richContentStyle} />
            ) : (
              <p style={mutedStyle}>Not set.</p>
            )}
          </div>
        </div>
      </details>
    </li>
  );
}
