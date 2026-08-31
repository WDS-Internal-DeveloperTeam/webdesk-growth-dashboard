import Link from "next/link";
import { notFound } from "next/navigation";
import type { SectionPatternRecord } from "@webdesk/shared-types";
import { ContentContainer, Fact, PageHeader, StatusBadge } from "@webdesk/ui";
import { SanitizedRichText } from "@/components/sanitized-rich-text";
import { SectionPatternStatusActions } from "@/components/section-pattern-status-actions";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import {
  dlStyle,
  h2Style,
  h3Style,
  mutedStyle,
  richContentStyle,
  sectionStyle,
  subsectionStyle,
} from "@/lib/detail-section-styles";
import { isSafeHttpUrl } from "@/lib/safe-http-url";
import {
  formatTimestamp,
  getSectionPattern,
  getSectionPatternVersions,
  PATTERN_TYPE_LABEL,
  sectionPatternApprovalStatusBadge,
} from "@/lib/section-and-pattern-library";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface SectionAndPatternLibraryDetailPageProps {
  readonly params: Promise<{ recordId: string }>;
}

/**
 * No approved wireframe exists for this module — sections mirror the backend's own field grouping
 * (Identity, Content, Code references, Responsiveness & accessibility, Relationships, Status,
 * Version history), rendered as sections rather than client-side tabs, the same simplification the
 * Project/Business Knowledge Center/Service Library/Persona Library/Website Strategy Center/Design
 * Token Library detail pages already establish.
 *
 * "Version history" mirrors `DesignTokenLibraryDetailPage`'s own genuinely novel requirement —
 * every version from `GET .../:recordId/versions` (oldest first, reversed here for newest-first
 * display) is listed with its own version number/status/name/updated timestamp, and its own
 * description/design reference/code references are viewable via a native
 * `<details>`/`<summary>` disclosure — zero client JS, fully server-rendered. Opening two
 * disclosures side by side is this module's answer to the canonical spec's own named "compare
 * versions" action, without inventing a real diffing UI no sibling module has ever built. The
 * CURRENT version's own content still renders in the normal sections above, exactly as every
 * sibling detail page renders its own primary content — the version-history list additionally
 * repeats it (as the "(current)"-labeled entry) so every version, including the current one, is
 * browsable through the identical mechanism (the same accepted, tracked debt
 * `WebsiteStrategyCenterDetailPage`'s/`DesignTokenLibraryDetailPage`'s own doc comments already
 * document once for the resulting double-render of the current version).
 *
 * `description`/`responsiveBehavior`/`accessibilityNotes` render through `SanitizedRichText` (real
 * HTML from the rich-text editor, sanitized at both write time and render time).
 * `htmlStructure`/`scssReference`/`browserSupport` render as plain text (`whiteSpace: pre-wrap`),
 * NOT through `SanitizedRichText` — the backend stores all three fields unsanitized as plain code
 * text, matching `SectionAndPatternLibraryForm`'s own identical reasoning for keeping them plain
 * `<textarea>`s.
 */
export default async function SectionAndPatternLibraryDetailPage({
  params,
}: SectionAndPatternLibraryDetailPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { recordId } = await params;
  const [record, versions] = await Promise.all([
    getSectionPattern(recordId),
    getSectionPatternVersions(recordId),
  ]);
  if (!record) {
    notFound();
  }

  const approvalBadge = sectionPatternApprovalStatusBadge(record.approvalStatus);
  // Newest first for display — the backend returns oldest first (its own natural insertion order).
  const versionsNewestFirst = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);

  return (
    <ContentContainer>
      <PageHeader
        title={record.name}
        breadcrumbs={[
          { label: "Section and Pattern Library", href: "/section-and-pattern-library" },
          { label: record.name },
        ]}
        linkComponent={Link}
        statusBadge={<StatusBadge status={approvalBadge.token} label={approvalBadge.label} />}
        contextActions={
          <>
            <SectionPatternStatusActions
              recordId={record.recordId}
              approvalStatus={record.approvalStatus}
            />
            {/* archived/superseded are terminal — the backend rejects any edit of one outright
                (section-patterns.service.ts's own update() guard), so the link is hidden rather
                than left clickable only to 400 on submit, matching
                SectionPatternStatusActions's own self-hiding behavior for these same two
                statuses. */}
            {record.approvalStatus !== "archived" && record.approvalStatus !== "superseded" ? (
              <Link
                href={`/section-and-pattern-library/${record.recordId}/edit`}
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
          <Fact label="Pattern type">{PATTERN_TYPE_LABEL[record.patternType]}</Fact>
          <Fact label="Version">v{record.versionNumber}</Fact>
          <Fact label="Created">{formatTimestamp(record.createdAt)}</Fact>
          <Fact label="Updated">{formatTimestamp(record.updatedAt)}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Content</h2>
        <div style={subsectionStyle}>
          <h3 style={h3Style}>Description</h3>
          {record.description ? (
            <SanitizedRichText html={record.description} style={richContentStyle} />
          ) : (
            <p style={mutedStyle}>Not set.</p>
          )}
        </div>
        <div style={subsectionStyle}>
          <h3 style={h3Style}>Design reference</h3>
          {record.designReference && isSafeHttpUrl(record.designReference) ? (
            <a href={record.designReference} target="_blank" rel="noreferrer noopener">
              {record.designReference}
            </a>
          ) : record.designReference ? (
            <p style={richContentStyle}>{record.designReference}</p>
          ) : (
            <p style={mutedStyle}>Not set.</p>
          )}
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Code references</h2>
        <PlainTextBlock label="HTML structure" value={record.htmlStructure} />
        <PlainTextBlock label="PHP path" value={record.phpPath} />
        <PlainTextBlock label="SCSS reference" value={record.scssReference} />
        <div style={subsectionStyle}>
          <h3 style={h3Style}>JS dependencies</h3>
          {record.jsDependencies.length > 0 ? (
            <p style={richContentStyle}>{record.jsDependencies.join(", ")}</p>
          ) : (
            <p style={mutedStyle}>Not set.</p>
          )}
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Responsiveness &amp; accessibility</h2>
        <div style={subsectionStyle}>
          <h3 style={h3Style}>Responsive behavior</h3>
          {record.responsiveBehavior ? (
            <SanitizedRichText html={record.responsiveBehavior} style={richContentStyle} />
          ) : (
            <p style={mutedStyle}>Not set.</p>
          )}
        </div>
        <div style={subsectionStyle}>
          <h3 style={h3Style}>Accessibility notes</h3>
          {record.accessibilityNotes ? (
            <SanitizedRichText html={record.accessibilityNotes} style={richContentStyle} />
          ) : (
            <p style={mutedStyle}>Not set.</p>
          )}
        </div>
        <PlainTextBlock label="Browser support" value={record.browserSupport} />
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Relationships</h2>
        <div style={subsectionStyle}>
          <h3 style={h3Style}>Token references</h3>
          {record.tokenReferences.length > 0 ? (
            <p style={richContentStyle}>{record.tokenReferences.join(", ")}</p>
          ) : (
            <p style={mutedStyle}>Not set.</p>
          )}
        </div>
        <div style={subsectionStyle}>
          <h3 style={h3Style}>Related component IDs</h3>
          {record.relatedComponentIds.length > 0 ? (
            <p style={richContentStyle}>{record.relatedComponentIds.join(", ")}</p>
          ) : (
            <p style={mutedStyle}>Not set.</p>
          )}
        </div>
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

function PlainTextBlock({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string | null;
}) {
  return (
    <div style={subsectionStyle}>
      <h3 style={h3Style}>{label}</h3>
      {value ? (
        <p style={{ ...richContentStyle, whiteSpace: "pre-wrap" }}>{value}</p>
      ) : (
        <p style={mutedStyle}>Not set.</p>
      )}
    </div>
  );
}

function VersionEntry({ version }: { readonly version: SectionPatternRecord }) {
  const badge = sectionPatternApprovalStatusBadge(version.approvalStatus);
  // Uses the version row's own isCurrent field (populated by the same GET .../:recordId/versions
  // response every entry here already comes from) rather than comparing this row's id against a
  // SEPARATE, independently-timed getSectionPattern() fetch — the two requests aren't
  // transactionally consistent, so a concurrent edit/status transition forking a new version
  // between them could otherwise mislabel which entry is current, the exact code-review fix
  // WebsiteStrategyCenterDetailPage's/DesignTokenLibraryDetailPage's own VersionEntry already
  // established.
  const isCurrent = version.isCurrent;

  return (
    <li
      style={{
        border: "1px solid var(--webdesk-dashboard-color-border)",
        borderRadius: "0.5rem",
        padding: "0.75rem 1rem",
        marginBottom: "0.75rem",
      }}
    >
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
          <span style={mutedStyle}>{version.name}</span>
          <span style={mutedStyle}>Updated {formatTimestamp(version.updatedAt)}</span>
        </summary>
        <div style={{ marginTop: "0.75rem" }}>
          <div style={subsectionStyle}>
            <h3 style={h3Style}>Description</h3>
            {version.description ? (
              <SanitizedRichText html={version.description} style={richContentStyle} />
            ) : (
              <p style={mutedStyle}>Not set.</p>
            )}
          </div>
          <PlainTextBlock label="HTML structure" value={version.htmlStructure} />
          <PlainTextBlock label="SCSS reference" value={version.scssReference} />
        </div>
      </details>
    </li>
  );
}
