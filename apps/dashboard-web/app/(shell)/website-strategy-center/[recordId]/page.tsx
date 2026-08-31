import Link from "next/link";
import { notFound } from "next/navigation";
import type { WebsiteStrategyRecord } from "@webdesk/shared-types";
import { ContentContainer, Fact, PageHeader, StatusBadge } from "@webdesk/ui";
import { SanitizedRichText } from "@/components/sanitized-rich-text";
import { WebsiteStrategyStatusActions } from "@/components/website-strategy-status-actions";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import {
  dlStyle,
  h2Style,
  h3Style,
  mutedStyle,
  richContentStyle,
  sectionStyle,
  subsectionStyle,
  versionCardStyle,
} from "@/lib/detail-section-styles";
import { getServerSession } from "@/lib/server-session";
import {
  formatTimestamp,
  getWebsiteStrategyRecord,
  getWebsiteStrategyRecordVersions,
  websiteStrategyApprovalStatusBadge,
} from "@/lib/website-strategy-center";
import { RECORD_TYPE_LABEL } from "@/lib/website-strategy-center-query";

export const dynamic = "force-dynamic";

interface WebsiteStrategyCenterDetailPageProps {
  readonly params: Promise<{ recordId: string }>;
}

/**
 * No approved wireframe exists for this module — sections mirror the backend's own field grouping
 * (Identity, Content, Status, Version history), rendered as sections rather than client-side tabs,
 * the same simplification the Project/Business Knowledge Center/Service Library/Persona Library
 * detail pages already establish.
 *
 * "Version history" is this module's own genuinely novel requirement — every other module built so
 * far has one mutable row per record, no real history. Every version from
 * `GET .../:recordId/versions` (oldest first, reversed here for newest-first display) is listed
 * with its own version number/status/title/updated timestamp, and its own title/content/notes are
 * viewable via a native `<details>`/`<summary>` disclosure — zero client JS, fully server-rendered,
 * matching this app's own zero-client-JS-where-possible precedent for detail pages. Opening two
 * disclosures side by side is this module's answer to the canonical spec's own named "compare
 * versions" action, without inventing a real diffing UI no sibling module has ever built. The
 * CURRENT version's own content still renders in the normal "Content" section above, exactly as
 * every sibling detail page renders its own primary content — the version-history list additionally
 * repeats it (as the "(current)"-labeled entry) so every version, including the current one, is
 * browsable through the identical mechanism.
 *
 * Code-review accepted debt: this means the current version's own content/notes are fetched and
 * server-rendered twice per page view (once above, once inside its own version-history entry).
 * Deliberate, not an oversight — filtering the current row out of the version-history list would
 * defeat the "every version, including the current one, browsable through the identical mechanism"
 * goal above, and rendering the repeated entry from `record` instead of `version` wouldn't reduce
 * the emitted bytes either (same string value, either source). A real fix needs either accepting
 * the duplication (as done here) or a genuinely different UI shape for the current-version entry —
 * out of scope for this pass.
 */
export default async function WebsiteStrategyCenterDetailPage({
  params,
}: WebsiteStrategyCenterDetailPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { recordId } = await params;
  const [record, versions] = await Promise.all([
    getWebsiteStrategyRecord(recordId),
    getWebsiteStrategyRecordVersions(recordId),
  ]);
  if (!record) {
    notFound();
  }

  const approvalBadge = websiteStrategyApprovalStatusBadge(record.approvalStatus);
  // Newest first for display — the backend returns oldest first (its own natural insertion order).
  const versionsNewestFirst = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);

  return (
    <ContentContainer>
      <PageHeader
        title={record.title}
        breadcrumbs={[
          { label: "Website Strategy Center", href: "/website-strategy-center" },
          { label: record.title },
        ]}
        linkComponent={Link}
        statusBadge={<StatusBadge status={approvalBadge.token} label={approvalBadge.label} />}
        contextActions={
          <>
            <WebsiteStrategyStatusActions
              recordId={record.recordId}
              approvalStatus={record.approvalStatus}
            />
            {/* archived/superseded are terminal — the backend rejects any edit of one outright
                (code-review finding), so the link is hidden rather than left clickable only to
                400 on submit, matching WebsiteStrategyStatusActions's own self-hiding behavior
                for these same two statuses. */}
            {record.approvalStatus !== "archived" && record.approvalStatus !== "superseded" ? (
              <Link
                href={`/website-strategy-center/${record.recordId}/edit`}
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
          <Fact label="Record type">{RECORD_TYPE_LABEL[record.recordType]}</Fact>
          <Fact label="Version">v{record.versionNumber}</Fact>
          <Fact label="Created">{formatTimestamp(record.createdAt)}</Fact>
          <Fact label="Updated">{formatTimestamp(record.updatedAt)}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Content</h2>
        <TextBlock label="Content" value={record.content} />
        <TextBlock label="Notes" value={record.notes} />
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

function TextBlock({ label, value }: { readonly label: string; readonly value: string | null }) {
  return (
    <div style={subsectionStyle}>
      <h3 style={h3Style}>{label}</h3>
      {value ? (
        <SanitizedRichText html={value} style={richContentStyle} />
      ) : (
        <p style={mutedStyle}>Not set.</p>
      )}
    </div>
  );
}

function VersionEntry({ version }: { readonly version: WebsiteStrategyRecord }) {
  const badge = websiteStrategyApprovalStatusBadge(version.approvalStatus);
  // Code-review fix: uses the version row's own isCurrent field (populated by the same
  // GET .../:recordId/versions response every entry here already comes from) rather than
  // comparing this row's id against a SEPARATE, independently-timed getWebsiteStrategyRecord()
  // fetch — the two requests aren't transactionally consistent, so a concurrent edit/status
  // transition forking a new version between them could otherwise mislabel which entry is
  // current.
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
          <span style={mutedStyle}>{version.title}</span>
          <span style={mutedStyle}>Updated {formatTimestamp(version.updatedAt)}</span>
        </summary>
        <div style={{ marginTop: "0.75rem" }}>
          <TextBlock label="Content" value={version.content} />
          <TextBlock label="Notes" value={version.notes} />
        </div>
      </details>
    </li>
  );
}
